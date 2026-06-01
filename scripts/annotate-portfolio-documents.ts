/**
 * Run portfolio document annotation in batches (parallel LLM calls per batch).
 *
 * Usage:
 *   npx tsx scripts/annotate-portfolio-documents.ts
 *   npx tsx scripts/annotate-portfolio-documents.ts --until-done
 *   npx tsx scripts/annotate-portfolio-documents.ts --batch-size 2000 --concurrency 6
 *
 * Env:
 *   PORTFOLIO_ANNOTATE_CONCURRENCY — 1, 6, or 32 (default 6)
 *   PORTFOLIO_ANNOTATE_BATCH_SIZE — default 2000
 *   PORTFOLIO_ANNOTATE_BATCH_DELAY_MS — pause between batches (default 3000)
 */

import { config as loadEnv } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_ANNOTATION_BATCH_SIZE,
  formatPortfolioAnnotationBatchSummary,
  resolveAnnotationConcurrency,
  runPortfolioDocumentAnnotationBatch,
} from "../src/lib/portfolio-intelligence/annotate-source-documents";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv: string[]) {
  const untilDone = argv.includes("--until-done");
  let batchSize = Number(process.env.PORTFOLIO_ANNOTATE_BATCH_SIZE ?? DEFAULT_ANNOTATION_BATCH_SIZE);
  let concurrency: number | undefined;
  let delayMs = Number(process.env.PORTFOLIO_ANNOTATE_BATCH_DELAY_MS ?? 3000);
  let maxBatches = 0;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--until-done") continue;
    if (arg === "--batch-size" && argv[i + 1]) {
      batchSize = Number(argv[++i]);
      continue;
    }
    if (arg === "--concurrency" && argv[i + 1]) {
      concurrency = Number(argv[++i]);
      continue;
    }
    if (arg === "--delay-ms" && argv[i + 1]) {
      delayMs = Number(argv[++i]);
      continue;
    }
    if (arg === "--max-batches" && argv[i + 1]) {
      maxBatches = Number(argv[++i]);
      continue;
    }
  }

  return {
    untilDone,
    batchSize: Math.max(1, Math.floor(batchSize) || DEFAULT_ANNOTATION_BATCH_SIZE),
    concurrency,
    delayMs: Math.max(0, delayMs),
    maxBatches: Math.max(0, Math.floor(maxBatches) || 0),
  };
}

async function main() {
  loadEnv({ path: resolve(process.cwd(), ".env") });
  loadEnv({ path: resolve(process.cwd(), ".env.local") });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error("Set OPENAI_API_KEY in .env.local");
    process.exit(1);
  }

  const args = parseArgs(process.argv);
  const supabase = createClient(url, key);

  let offset = 0;
  let batchNum = 0;
  let totalSucceeded = 0;
  let totalFailed = 0;

  console.log(
    `Portfolio annotation — batch size ${args.batchSize}, concurrency ${args.concurrency ?? "(env/default)"}, until-done ${args.untilDone}\n`
  );

  for (;;) {
    batchNum += 1;
    if (args.maxBatches > 0 && batchNum > args.maxBatches) {
      console.log(`Stopped: reached --max-batches ${args.maxBatches}`);
      break;
    }

    console.log(`--- Batch ${batchNum} (offset ${offset}) ---`);
    const result = await runPortfolioDocumentAnnotationBatch(supabase, {
      limit: args.batchSize,
      offset,
      concurrency: resolveAnnotationConcurrency(args.concurrency),
      skipAlreadyAnnotated: true,
      maxAttempts: 3,
    });
    console.log(formatPortfolioAnnotationBatchSummary(result));
    console.log("");

    totalSucceeded += result.succeeded;
    totalFailed += result.failed;
    offset += result.processed;

    if (!args.untilDone) break;
    if (result.processed < args.batchSize) {
      console.log("Reached end of source_documents table.");
      break;
    }
    if (result.candidates === 0) {
      console.log("No LLM candidates in this slice (all skipped). Advancing offset…");
    }
    if (args.delayMs > 0) await sleep(args.delayMs);
  }

  console.log("---");
  console.log(`Total succeeded: ${totalSucceeded}, total failed (this run): ${totalFailed}`);
  if (totalFailed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
