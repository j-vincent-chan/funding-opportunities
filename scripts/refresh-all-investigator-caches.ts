/**
 * Refresh PubMed + NIH RePORTER + ClinicalTrials.gov for every investigator, then rebuild co-authorship edges.
 *
 * Usage (from repo root):
 *   npm run refresh-investigator-caches
 *   npm run refresh-investigator-caches -- --concurrency 6
 *
 * Requires in .env.local (or env):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   NCBI_API_KEY — enables ~10 req/s PubMed (auto 110ms spacing unless NCBI_EUTILS_INTERVAL_MS set)
 *   NCBI_CONTACT_EMAIL
 *   BULK_REFRESH_CONCURRENCY — default parallel investigators (default 4, max 12)
 *   NCBI_EUTILS_INTERVAL_MS, CLINICALTRIALS_MIN_INTERVAL_MS, REPORTER_MIN_INTERVAL_MS
 */

import { config as loadEnv } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local") });

import {
  formatBulkRefreshSummary,
  refreshAllInvestigatorsCommunityCaches,
  resolveBulkRefreshConcurrency,
} from "../src/lib/community/bulk-refresh-investigator-caches";

function parseArgs(argv: string[]): { concurrency?: number } {
  let concurrency: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--concurrency" && argv[i + 1]) {
      concurrency = Number(argv[++i]);
    }
  }
  return { concurrency };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const concurrency = resolveBulkRefreshConcurrency(args.concurrency);

  const supabase = createClient(url, key);
  console.log(
    `Refreshing PubMed + RePORTER + ClinicalTrials.gov for all investigators (concurrency ${concurrency})…\n`
  );

  const result = await refreshAllInvestigatorsCommunityCaches(supabase, { concurrency });
  console.log(formatBulkRefreshSummary(result));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
