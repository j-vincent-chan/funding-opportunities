import type { SupabaseClient } from "@supabase/supabase-js";
import { recomputeCoauthorshipFromPublications } from "@/lib/community/collaborations";
import { refreshInvestigatorPubMed } from "@/lib/community/pubmed-ingest";
import { refreshInvestigatorReporter } from "@/lib/community/reporter-ingest";

const DEFAULT_DELAY_MS = 400;

export type BulkRefreshInvestigatorCachesResult = {
  totalInvestigators: number;
  pubmedOk: number;
  pubmedErr: number;
  reporterOk: number;
  reporterSkippedNoProfile: number;
  reporterErr: number;
  pubmedErrors: { id: string; message: string }[];
  reporterErrors: { id: string; message: string }[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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

/**
 * Refresh PubMed and NIH RePORTER caches for every investigator, then recompute co-authorship edges.
 * Intended for admin actions or CLI; uses sequential requests with a delay to reduce API throttling.
 */
export async function refreshAllInvestigatorsCommunityCaches(
  supabase: SupabaseClient,
  opts: { delayMs?: number } = {}
): Promise<BulkRefreshInvestigatorCachesResult> {
  const delayMs = opts.delayMs ?? DEFAULT_DELAY_MS;
  const ids = await fetchAllInvestigatorIds(supabase);

  const result: BulkRefreshInvestigatorCachesResult = {
    totalInvestigators: ids.length,
    pubmedOk: 0,
    pubmedErr: 0,
    reporterOk: 0,
    reporterSkippedNoProfile: 0,
    reporterErr: 0,
    pubmedErrors: [],
    reporterErrors: [],
  };

  const pushErr = (
    list: { id: string; message: string }[],
    id: string,
    message: string
  ) => {
    if (list.length < 25) list.push({ id, message });
  };

  for (const id of ids) {
    try {
      await refreshInvestigatorPubMed(supabase, id);
      result.pubmedOk += 1;
    } catch (e) {
      result.pubmedErr += 1;
      pushErr(
        result.pubmedErrors,
        id,
        e instanceof Error ? e.message : String(e)
      );
    }

    await sleep(delayMs);

    try {
      const rep = await refreshInvestigatorReporter(supabase, id);
      if (rep.skipped === "missing_nih_profile_id") {
        result.reporterSkippedNoProfile += 1;
      } else {
        result.reporterOk += 1;
      }
    } catch (e) {
      result.reporterErr += 1;
      pushErr(
        result.reporterErrors,
        id,
        e instanceof Error ? e.message : String(e)
      );
    }

    await sleep(delayMs);
  }

  await recomputeCoauthorshipFromPublications(supabase);

  return result;
}

export function formatBulkRefreshSummary(r: BulkRefreshInvestigatorCachesResult): string {
  const lines = [
    `Investigators processed: ${r.totalInvestigators}`,
    `PubMed: ${r.pubmedOk} ok, ${r.pubmedErr} failed`,
    `RePORTER: ${r.reporterOk} refreshed, ${r.reporterSkippedNoProfile} skipped (no NIH profile id), ${r.reporterErr} failed`,
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
  return lines.join("\n");
}
