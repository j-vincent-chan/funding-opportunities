import type { SupabaseClient } from "@supabase/supabase-js";
import { applyFundingListOrFilters } from "@/lib/funding-opportunities/keyword-filter";
import {
  applyRdFiltersToFundingQuery,
  isMissingRdColumnsPostgrestError,
  rdFiltersActive,
} from "@/lib/funding-opportunities/rd-list-filters";
import {
  fundingListRowEligibleForEmailNotification,
  fundingListRowScope,
} from "@/lib/funding-opportunities/funding-list-row-scope";
import type { FundingListClientState } from "@/lib/funding-opportunities/funding-list-url";

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
  const { rows: recentRows } = await fetchRecentMatchingOpportunitiesForSavedSearch(
    supabase,
    state,
    recentSince,
    options
  );

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
  };
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
  const agencySelection = {
    departments: state.departments,
    departmentSubs: state.departmentSubs,
    legacyAgencies: state.legacyAgencies,
  };
  const rdWithoutNihIc = { ...state.rd, nihIc: [] as string[] };
  const today = new Date(new Date().toDateString());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function runQuery(rdFilters: boolean, heuristicSelect: boolean): Promise<any> {
    const selectStr = heuristicSelect
      ? FUNDING_NOTIFICATION_SELECT
      : "id, title, agency, opportunity_number, close_date, posted_date, funding_instrument, status, forecasted, updated_at";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from("funding_opportunities")
      .select(selectStr)
      .gte("updated_at", sinceIso)
      .order("updated_at", { ascending: false })
      .limit(NOTIFICATION_FETCH_LIMIT);
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
    if (!includeForecasted && bucket === "forecasted") continue;
    if (!fundingListRowEligibleForEmailNotification(bucket, state.scope)) continue;
    rows.push(r);
  }

  return { rows };
}
