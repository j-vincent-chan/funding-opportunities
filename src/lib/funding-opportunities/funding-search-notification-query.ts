import type { SupabaseClient } from "@supabase/supabase-js";
import { applyFundingListOrFilters } from "@/lib/funding-opportunities/keyword-filter";
import {
  applyRdFiltersToFundingQuery,
  isMissingRdColumnsPostgrestError,
  rdFiltersActive,
} from "@/lib/funding-opportunities/rd-list-filters";
import {
  fundingListRowEligibleForEmailNotification,
  fundingListRowMatchesScope,
  fundingListRowScope,
} from "@/lib/funding-opportunities/funding-list-row-scope";
import type { FundingListClientState } from "@/lib/funding-opportunities/funding-list-url";
import { DEFAULT_MAX_NOFOS_PER_SYNC } from "@/lib/services/simpler-grants-sync";

/** Columns required for list filters + RD filters + email row bucket. */
export const FUNDING_NOTIFICATION_SELECT =
  "id, title, agency, opportunity_number, close_date, posted_date, funding_instrument, status, forecasted, updated_at, " +
  "activity_families, clinical_trial_mode, nih_ic_tokens, rd_announcement_class, rd_research_pathway, rd_investigator_tags, rd_mechanism_type, rd_collaboration, rd_human_subjects";

export type FundingNotificationCandidateRow = {
  id: string;
  title: string;
  agency: string | null;
  opportunity_number: string | null;
  close_date: string | null;
  posted_date: string | null;
  funding_instrument: string | null;
  status: string | null;
  forecasted: boolean | null;
  updated_at: string;
  activity_families?: string[] | null;
  clinical_trial_mode?: string | null;
  nih_ic_tokens?: string[] | null;
  rd_announcement_class?: string | null;
  rd_research_pathway?: string | null;
  rd_investigator_tags?: string[] | null;
  rd_mechanism_type?: string | null;
  rd_collaboration?: string | null;
  rd_human_subjects?: string | null;
};

const NOTIFICATION_FETCH_LIMIT = 2500;

/** Same lookback window as funding-search-notifications cron digests. */
export const FUNDING_SEARCH_NEW_MATCH_LOOKBACK_HOURS = 72;

export type SavedSearchMatchQueryOptions = {
  includeForecasted?: boolean;
};

export type SavedSearchMatchStats = {
  newResultsRecent: number;
  newMatchesSinceViewed: number;
  lastMatchedAt: string | null;
  totalMatches: number;
};

export async function countRecentMatchingOpportunitiesForSavedSearch(
  supabase: SupabaseClient,
  state: FundingListClientState,
  sinceIso?: string,
  options?: SavedSearchMatchQueryOptions
): Promise<number> {
  const since =
    sinceIso ??
    new Date(Date.now() - FUNDING_SEARCH_NEW_MATCH_LOOKBACK_HOURS * 3600 * 1000).toISOString();
  const { rows } = await fetchRecentMatchingOpportunitiesForSavedSearch(supabase, state, since, options);
  return rows.length;
}

export async function getSavedSearchMatchStats(
  supabase: SupabaseClient,
  state: FundingListClientState,
  input: {
    lastViewedAt?: string | null;
    includeForecasted?: boolean;
  }
): Promise<SavedSearchMatchStats> {
  const recentSince = new Date(
    Date.now() - FUNDING_SEARCH_NEW_MATCH_LOOKBACK_HOURS * 3600 * 1000
  ).toISOString();
  const options: SavedSearchMatchQueryOptions = {
    includeForecasted: input.includeForecasted ?? true,
  };
  const [{ rows: recentRows }, { rows: totalRows }] = await Promise.all([
    fetchRecentMatchingOpportunitiesForSavedSearch(supabase, state, recentSince, options),
    fetchMatchingOpportunitiesForSavedSearch(supabase, state),
  ]);

  const viewedSince = input.lastViewedAt?.trim() || null;
  let newMatchesSinceViewed = recentRows.length;
  if (viewedSince) {
    const viewedMs = new Date(viewedSince).getTime();
    newMatchesSinceViewed = recentRows.filter((row) => {
      const updatedMs = new Date(row.updated_at).getTime();
      return Number.isFinite(updatedMs) && updatedMs > viewedMs;
    }).length;
  }

  const lastMatchedAt = recentRows[0]?.updated_at ?? null;

  return {
    newResultsRecent: recentRows.length,
    newMatchesSinceViewed,
    lastMatchedAt,
    totalMatches: totalRows.length,
  };
}

type SavedSearchMatchFetchOptions = SavedSearchMatchQueryOptions & {
  updatedSince?: string;
  fetchLimit?: number;
};

/**
 * All opportunities matching keyword/agency/NIH IC + RD filters and the saved list scope
 * (same filters as the funding list, without the recent-update window used for alerts).
 */
export async function fetchMatchingOpportunitiesForSavedSearch(
  supabase: SupabaseClient,
  state: FundingListClientState,
  options?: Pick<SavedSearchMatchFetchOptions, "fetchLimit">
): Promise<{ rows: FundingNotificationCandidateRow[]; warning?: string }> {
  return runSavedSearchMatchQuery(supabase, state, {
    fetchLimit: options?.fetchLimit ?? DEFAULT_MAX_NOFOS_PER_SYNC,
    rowFilter: (bucket) => fundingListRowMatchesScope(bucket, state.scope),
  });
}

/**
 * Opportunities updated since `sinceIso` that match keyword/agency/NIH IC + RD filters,
 * then narrowed to posted/forecasted rows that satisfy the saved list scope.
 */
export async function fetchRecentMatchingOpportunitiesForSavedSearch(
  supabase: SupabaseClient,
  state: FundingListClientState,
  sinceIso: string,
  options?: SavedSearchMatchQueryOptions
): Promise<{ rows: FundingNotificationCandidateRow[]; warning?: string }> {
  const includeForecasted = options?.includeForecasted !== false;
  return runSavedSearchMatchQuery(supabase, state, {
    updatedSince: sinceIso,
    fetchLimit: NOTIFICATION_FETCH_LIMIT,
    rowFilter: (bucket) => {
      if (!includeForecasted && bucket === "forecasted") return false;
      return fundingListRowEligibleForEmailNotification(bucket, state.scope);
    },
  });
}

async function runSavedSearchMatchQuery(
  supabase: SupabaseClient,
  state: FundingListClientState,
  options: {
    updatedSince?: string;
    fetchLimit: number;
    rowFilter: (bucket: ReturnType<typeof fundingListRowScope>) => boolean;
  }
): Promise<{ rows: FundingNotificationCandidateRow[]; warning?: string }> {
  const agencySelection = {
    departments: state.departments,
    departmentSubs: state.departmentSubs,
    legacyAgencies: state.legacyAgencies,
    noDepartmentsSelected: state.noDepartmentsSelected,
  };
  const rdWithoutNihIc = { ...state.rd, nihIc: [] as string[] };
  const today = new Date(new Date().toDateString());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function runQuery(rdFilters: boolean, heuristicSelect: boolean): Promise<any> {
    const selectStr = heuristicSelect
      ? FUNDING_NOTIFICATION_SELECT
      : "id, title, agency, opportunity_number, close_date, posted_date, funding_instrument, status, forecasted, updated_at";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from("funding_opportunities").select(selectStr).limit(options.fetchLimit);
    if (options.updatedSince) {
      q = q.gte("updated_at", options.updatedSince).order("updated_at", { ascending: false });
    } else {
      q = q.order("posted_date", { ascending: false, nullsFirst: false });
    }
    q = applyFundingListOrFilters(q, state.q, agencySelection, state.rd.nihIc);
    if (rdFilters && rdFiltersActive(rdWithoutNihIc)) {
      q = applyRdFiltersToFundingQuery(q, rdWithoutNihIc);
    }
    return q;
  }

  let res = await runQuery(true, true);
  if (
    res.error &&
    rdFiltersActive(rdWithoutNihIc) &&
    isMissingRdColumnsPostgrestError(res.error.message)
  ) {
    res = await runQuery(false, true);
  }
  if (res.error && isMissingRdColumnsPostgrestError(res.error.message)) {
    res = await runQuery(false, false);
  }

  if (res.error) {
    return { rows: [], warning: res.error.message };
  }

  const raw = (res.data ?? []) as FundingNotificationCandidateRow[];
  const rows: FundingNotificationCandidateRow[] = [];
  for (const r of raw) {
    const bucket = fundingListRowScope(r, today);
    if (!options.rowFilter(bucket)) continue;
    rows.push(r);
  }

  return { rows };
}
