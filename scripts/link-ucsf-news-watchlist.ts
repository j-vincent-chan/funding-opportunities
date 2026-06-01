/**
 * Match UCSF News community_source_items to watchlist investigators by name.
 *
 * Usage:
 *   npx tsx scripts/link-ucsf-news-watchlist.ts
 *   npx tsx scripts/link-ucsf-news-watchlist.ts 5000
 *   npx tsx scripts/link-ucsf-news-watchlist.ts --until-done
 *   npx tsx scripts/link-ucsf-news-watchlist.ts --until-done 2000
 */

import { config as loadEnv } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import {
  formatLinkUcsfNewsSummary,
  linkUcsfNewsItemsToWatchlist,
  linkUcsfNewsUntilExhausted,
} from "../src/lib/community/ucsf-news-investigator-linking";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const untilDone = args.includes("--until-done");
  const numericArg = args.find((a) => a !== "--until-done" && /^\d+$/.test(a));
  const batchSize = numericArg ? Number(numericArg) : 2000;
  const supabase = createClient(url, key);

  let errors: string[] = [];

  if (untilDone) {
    console.log(
      `Linking UCSF News in batches of ${batchSize} until no unscanned rows remain…\n`
    );
    const result = await linkUcsfNewsUntilExhausted(supabase, {
      batchSize: Number.isFinite(batchSize) ? batchSize : 2000,
      onlyUnlinked: true,
      fetchArticleBodies: true,
    });
    console.log(`Rounds: ${result.rounds}`);
    console.log(formatLinkUcsfNewsSummary(result));
    errors = result.errors;
  } else {
    console.log(`Linking up to ${batchSize} UCSF News rows to watchlist…\n`);
    const result = await linkUcsfNewsItemsToWatchlist(supabase, {
      maxItems: Number.isFinite(batchSize) ? batchSize : 2000,
      onlyUnlinked: true,
      fetchArticleBodies: true,
    });
    console.log(formatLinkUcsfNewsSummary(result));
    errors = result.errors;
  }

  if (errors.length) {
    console.log("\nErrors:", errors.join("\n"));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
