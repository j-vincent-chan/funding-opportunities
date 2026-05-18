/**
 * Refresh PubMed + NIH RePORTER for every investigator, then rebuild co-authorship edges.
 *
 * Usage (from repo root):
 *   npm run refresh-investigator-caches
 *
 * Requires in .env.local (or env):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional: NCBI_CONTACT_EMAIL (PubMed politeness)
 */

import { config as loadEnv } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Next.js uses `.env.local`; default `dotenv/config` only loads `.env`.
loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local") });
import {
  formatBulkRefreshSummary,
  refreshAllInvestigatorsCommunityCaches,
} from "../src/lib/community/bulk-refresh-investigator-caches";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  console.log("Refreshing PubMed + RePORTER for all investigators (this may take several minutes)…\n");

  const result = await refreshAllInvestigatorsCommunityCaches(supabase);
  console.log(formatBulkRefreshSummary(result));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
