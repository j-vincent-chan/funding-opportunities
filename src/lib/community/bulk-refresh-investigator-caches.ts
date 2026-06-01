import type { SupabaseClient } from "@supabase/supabase-js";
import { recomputeCoauthorshipFromPublications } from "@/lib/community/collaborations";
import { refreshInvestigatorClinicalTrials } from "@/lib/community/clinicaltrials-ingest";
import { refreshInvestigatorPubMed } from "@/lib/community/pubmed-ingest";
import { refreshInvestigatorReporter } from "@/lib/community/reporter-ingest";
import { syncInvestigatorCommunitySignalsFromCaches } from "@/lib/community/sync-community-signals-from-caches";
import { runWorkerPool } from "@/lib/utils/async-rate-limiter";

const DEFAULT_CONCURRENCY = 4;
const MAX_CONCURRENCY = 12;

export type BulkRefreshInvestigatorCachesResult = {
  totalInvestigators: number;
  concurrency: number;
  pubmedOk: number;
  pubmedErr: number;
  reporterOk: number;
  reporterSkippedNoProfile: number;
  reporterErr: number;
  clinicalTrialsOk: number;
  clinicalTrialsErr: number;
  pubmedErrors: { id: string; message: string }[];
  reporterErrors: { id: string; message: string }[];
  clinicalTrialsErrors: { id: string; message: string }[];
};

function pushErr(
  list: { id: string; message: string }[],
  id: string,
  message: string
) {
  if (list.length < 25) list.push({ id, message });
}

/** Resolve parallel investigator workers (1–12). */
export function resolveBulkRefreshConcurrency(value?: number): number {
  if (value != null && Number.isFinite(value)) {
    return Math.max(1, Math.min(MAX_CONCURRENCY, Math.floor(value)));
  }
  const env = process.env.BULK_REFRESH_CONCURRENCY?.trim();
  const fromEnv = env ? parseInt(env, 10) : NaN;
  if (Number.isFinite(fromEnv)) {
    return Math.max(1, Math.min(MAX_CONCURRENCY, fromEnv));
  }
  return DEFAULT_CONCURRENCY;
}

async function fetchAllInvestigatorIds(supabase: SupabaseClient): Promise<string[]> {
  const ids: string[] = [];
  const pageSize = 500;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("investigators")
      .select("id")
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const r of rows) {
      if (r.id) ids.push(String(r.id));
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return ids;
}

type MutableBulkResult = BulkRefreshInvestigatorCachesResult;

async function refreshOneInvestigatorCaches(
  supabase: SupabaseClient,
  id: string,
  result: MutableBulkResult
): Promise<void> {
  const [pubmedSettled, reporterSettled, trialsSettled] = await Promise.allSettled([
    refreshInvestigatorPubMed(supabase, id),
    refreshInvestigatorReporter(supabase, id),
    refreshInvestigatorClinicalTrials(supabase, id),
  ]);

  if (pubmedSettled.status === "fulfilled") {
    result.pubmedOk += 1;
  } else {
    result.pubmedErr += 1;
    pushErr(
      result.pubmedErrors,
      id,
      pubmedSettled.reason instanceof Error
        ? pubmedSettled.reason.message
        : String(pubmedSettled.reason)
    );
  }

  if (reporterSettled.status === "fulfilled") {
    if (reporterSettled.value.skipped === "missing_nih_profile_id") {
      result.reporterSkippedNoProfile += 1;
    } else {
      result.reporterOk += 1;
    }
  } else {
    result.reporterErr += 1;
    pushErr(
      result.reporterErrors,
      id,
      reporterSettled.reason instanceof Error
        ? reporterSettled.reason.message
        : String(reporterSettled.reason)
    );
  }

  if (trialsSettled.status === "fulfilled") {
    result.clinicalTrialsOk += 1;
  } else {
    result.clinicalTrialsErr += 1;
    pushErr(
      result.clinicalTrialsErrors,
      id,
      trialsSettled.reason instanceof Error
        ? trialsSettled.reason.message
        : String(trialsSettled.reason)
    );
  }

  try {
    await syncInvestigatorCommunitySignalsFromCaches(supabase, id);
  } catch {
    // Community signal sync is best-effort during bulk refresh.
  }
}

/**
 * Refresh PubMed, NIH RePORTER, and ClinicalTrials.gov caches for every investigator,
 * then recompute co-authorship edges.
 *
 * Per investigator, the three external APIs run in parallel. Multiple investigators
 * run concurrently up to `concurrency`. Global rate limiters serialize NCBI / CT / RePORTER
 * requests to reduce 429s.
 */
export async function refreshAllInvestigatorsCommunityCaches(
  supabase: SupabaseClient,
  opts: { concurrency?: number } = {}
): Promise<BulkRefreshInvestigatorCachesResult> {
  const concurrency = resolveBulkRefreshConcurrency(opts.concurrency);
  const ids = await fetchAllInvestigatorIds(supabase);

  const result: BulkRefreshInvestigatorCachesResult = {
    totalInvestigators: ids.length,
    concurrency,
    pubmedOk: 0,
    pubmedErr: 0,
    reporterOk: 0,
    reporterSkippedNoProfile: 0,
    reporterErr: 0,
    clinicalTrialsOk: 0,
    clinicalTrialsErr: 0,
    pubmedErrors: [],
    reporterErrors: [],
    clinicalTrialsErrors: [],
  };

  await runWorkerPool(ids, concurrency, async (id) => {
    await refreshOneInvestigatorCaches(supabase, id, result);
  });

  await recomputeCoauthorshipFromPublications(supabase);

  return result;
}

export function formatBulkRefreshSummary(r: BulkRefreshInvestigatorCachesResult): string {
  const lines = [
    `Investigators processed: ${r.totalInvestigators} (concurrency ${r.concurrency})`,
    `PubMed: ${r.pubmedOk} ok, ${r.pubmedErr} failed`,
    `RePORTER: ${r.reporterOk} refreshed, ${r.reporterSkippedNoProfile} skipped (no NIH profile id), ${r.reporterErr} failed`,
    `ClinicalTrials.gov: ${r.clinicalTrialsOk} ok, ${r.clinicalTrialsErr} failed`,
    `Co-authorship graph recomputed from shared publications.`,
  ];
  if (r.pubmedErrors.length) {
    lines.push(`PubMed sample errors: ${r.pubmedErrors.map((e) => `${e.id.slice(0, 8)}… ${e.message}`).join(" | ")}`);
  }
  if (r.reporterErrors.length) {
    lines.push(
      `RePORTER sample errors: ${r.reporterErrors.map((e) => `${e.id.slice(0, 8)}… ${e.message}`).join(" | ")}`
    );
  }
  if (r.clinicalTrialsErrors.length) {
    lines.push(
      `ClinicalTrials.gov sample errors: ${r.clinicalTrialsErrors.map((e) => `${e.id.slice(0, 8)}… ${e.message}`).join(" | ")}`
    );
  }
  return lines.join("\n");
}
