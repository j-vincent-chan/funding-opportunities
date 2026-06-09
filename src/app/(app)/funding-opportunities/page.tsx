import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/formatting/dates";
import { SimplerSyncControls } from "@/components/funding/simpler-sync-controls";
import { applyFundingListOrFilters } from "@/lib/funding-opportunities/keyword-filter";
import { DEFAULT_MAX_NOFOS_PER_SYNC } from "@/lib/services/simpler-grants-sync";
import {
  applyRdFiltersToFundingQuery,
  isMissingRdColumnsPostgrestError,
  parseRdListFilters,
  rdFiltersActive,
  type SearchParams,
} from "@/lib/funding-opportunities/rd-list-filters";
import {
  agenciesFromSearchParams,
  departmentsFromSearchParams,
  firstStringParam,
  fundingListHref,
  fundingListHrefWithSortOverride,
  departmentSubsFromSearchParams,
  isDepartmentSubsEmpty,
  nextColumnSort,
  parseFundingListPagination,
  parseListSort,
  parseClosingDays,
  parsePostedDays,
  resolveListScope,
  type FundingListSortKey,
} from "@/lib/funding-opportunities/funding-list-url";
import { type FundingQuickFiltersCounts } from "@/components/funding/funding-quick-filters-bar";
import { FundingListToolbar } from "@/components/funding/funding-list-toolbar";
import {
  isEsiCareerDevelopment,
  isFoundationOpportunity,
  isInvestigatorInitiated,
  isRecommendedMatch,
  looksLargeCollaborativeGrant,
  recommendationScore as scoreRecommendation,
} from "@/lib/funding-opportunities/funding-quick-filter-heuristics";
import { FundingListKeywordSearch } from "@/components/funding/funding-list-keyword-search";
import { FundingChatPanel } from "@/components/funding/funding-chat-panel";
import { FundingListPagination } from "@/components/funding/funding-list-pagination";
import { FundingOpportunitiesFiltersPanel } from "@/components/funding/funding-opportunities-filters-panel";
import {
  FundingListResultsTable,
  type FundingListResultsRow,
} from "@/components/funding/funding-list-results-table";
import { normalizeAgencyDisplayName } from "@/lib/funding-opportunities/agency-display";
import {
  formatSavedSearchFilterSummary,
  parseSavedFundingListState,
} from "@/lib/funding-opportunities/saved-funding-list-state";
import { fetchSavedFundingSearchesForUser } from "@/lib/funding-opportunities/saved-funding-search-query";
import { fetchActiveRdsgOwnersForAlerts } from "@/lib/funding-opportunities/saved-search-alert-recipients";
import { FundingSearchBookmarksRail } from "@/components/funding/funding-search-bookmarks-rail";
import { type SavedSearchLink } from "@/components/funding/funding-saved-searches-strip";
import { getSavedSearchMatchStats } from "@/lib/funding-opportunities/funding-search-notification-query";
import {
  FundingOpportunityPeekPanel,
  FundingOpportunityPeekProvider,
} from "@/components/funding/funding-opportunity-peek-panel";
import { resolveFundingSourceUrl } from "@/lib/funding-opportunities/source-url";
import {
  fundingListRowMatchesScope,
  fundingListRowScope,
  type FundingListRowBucket,
} from "@/lib/funding-opportunities/funding-list-row-scope";

type OpportunityViewTab =
  | "all"
  | "recommended"
  | "closing_soon"
  | "new_this_week"
  | "large_awards"
  | "esi_career"
  | "investigator_initiated"
  | "foundations"
  | "saved"
  | "immunology_translational";

function resolveOpportunityTab(searchParams: SearchParams): OpportunityViewTab {
  const raw = typeof searchParams.tab === "string" ? searchParams.tab : "";
  if (
    raw === "all" ||
    raw === "recommended" ||
    raw === "closing_soon" ||
    raw === "new_this_week" ||
    raw === "large_awards" ||
    raw === "esi_career" ||
    raw === "investigator_initiated" ||
    raw === "foundations" ||
    raw === "saved" ||
    raw === "immunology_translational"
  ) {
    return raw;
  }
  return "all";
}

function withTabParam(href: string, tab: OpportunityViewTab): string {
  if (tab === "all") return href;
  const [base, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("tab", tab);
  return `${base}?${params.toString()}`;
}

function buildFundingListUrl(
  current: SearchParams,
  next: { sort: string; order: "asc" | "desc" },
  tab: OpportunityViewTab
): string {
  return withTabParam(fundingListHrefWithSortOverride(current, next.sort, next.order), tab);
}

const SORT_COLUMNS: FundingListSortKey[] = [
  "title",
  "agency",
  "status",
  "posted_date",
  "close_date",
  "funding_instrument",
];

export default async function FundingOpportunitiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const activeTab = resolveOpportunityTab(searchParams);
  const scope = resolveListScope(searchParams);
  const sortState = parseListSort(searchParams);
  const rdFilterState = parseRdListFilters(searchParams);
  const agencySelection = {
    departments: departmentsFromSearchParams(searchParams),
    departmentSubs: departmentSubsFromSearchParams(searchParams),
    legacyAgencies: agenciesFromSearchParams(searchParams),
  };
  const hasAgencyFilter =
    agencySelection.departments.length > 0 ||
    !isDepartmentSubsEmpty(agencySelection.departmentSubs) ||
    agencySelection.legacyAgencies.length > 0;
  const qParam = firstStringParam(searchParams.q);
  const { page: requestedPage, perPage } = parseFundingListPagination(searchParams);

  const supabase = createClient();

  const { key: sortKey, dir: sortDir } = sortState;
  const asc = sortDir === "asc";
  const clientSortOnly = sortKey === "status";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applySortOrder(query: any): any {
    let qq = query;
    if (!clientSortOnly) {
      if (sortKey === "title") {
        qq = qq.order("title", { ascending: asc, nullsFirst: false });
      } else if (sortKey === "agency") {
        qq = qq.order("agency", { ascending: asc, nullsFirst: false });
      } else if (sortKey === "posted_date") {
        qq = qq.order("posted_date", { ascending: asc, nullsFirst: false });
      } else if (sortKey === "close_date") {
        qq = qq.order("close_date", { ascending: asc, nullsFirst: false });
      } else if (sortKey === "funding_instrument") {
        qq = qq.order("funding_instrument", { ascending: asc, nullsFirst: false });
      } else {
        qq = qq.order("close_date", { ascending: true, nullsFirst: false });
      }
    } else {
      qq = qq.order("close_date", { ascending: true, nullsFirst: false });
    }
    return qq;
  }

  const fundingListSelectBase =
    "id, title, agency, agency_code, close_date, posted_date, funding_instrument, status, forecasted, source_system, source_opportunity_id";
  const fundingListSelectWithHeuristics = `${fundingListSelectBase}, activity_families`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function buildFundingListQuery(opts: { rdFilters: boolean; heuristicColumns: boolean }): any {
    const selectStr = opts.heuristicColumns ? fundingListSelectWithHeuristics : fundingListSelectBase;
    let query = supabase.from("funding_opportunities").select(selectStr).limit(DEFAULT_MAX_NOFOS_PER_SYNC);
    query = applyFundingListOrFilters(query, qParam, agencySelection, rdFilterState.nihIc);
    const rdWithoutNihIc = { ...rdFilterState, nihIc: [] as string[] };
    if (opts.rdFilters && rdFiltersActive(rdWithoutNihIc)) {
      query = applyRdFiltersToFundingQuery(query, rdWithoutNihIc);
    }
    return applySortOrder(query);
  }

  const initialListPromise = buildFundingListQuery({
    rdFilters: true,
    heuristicColumns: true,
  });

  const [countResult, firstList] = await Promise.all([
    supabase.from("funding_opportunities").select("id", { count: "exact", head: true }),
    initialListPromise,
  ]);

  const fundingOppDbTotal = countResult.count;

  let rdFiltersSkippedMigration = false;
  let listIncludesActivityFamilies = true;
  let { data: rows, error } = firstList;
  if (
    error &&
    rdFiltersActive(rdFilterState) &&
    isMissingRdColumnsPostgrestError(error.message)
  ) {
    rdFiltersSkippedMigration = true;
    const second = await buildFundingListQuery({ rdFilters: false, heuristicColumns: true });
    rows = second.data;
    error = second.error;
  }
  if (error && isMissingRdColumnsPostgrestError(error.message)) {
    listIncludesActivityFamilies = false;
    const third = await buildFundingListQuery({ rdFilters: false, heuristicColumns: false });
    rows = third.data;
    error = third.error;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const dismissedOppIds = new Set<string>();
  if (user) {
    const dismissedRes = await supabase
      .from("dismissed_funding_opportunities")
      .select("opportunity_id")
      .eq("user_id", user.id)
      .limit(DEFAULT_MAX_NOFOS_PER_SYNC);
    if (!dismissedRes.error) {
      for (const row of dismissedRes.data ?? []) {
        if (row.opportunity_id) dismissedOppIds.add(row.opportunity_id);
      }
    }
  }

  const today = new Date(new Date().toDateString());
  type FundingListRow = {
    id: string;
    title: string;
    agency: string | null;
    agency_code: string | null;
    close_date: string | null;
    posted_date: string | null;
    funding_instrument: string | null;
    status: string | null;
    forecasted: boolean | null;
    source_system?: string | null;
    source_opportunity_id?: string | null;
    activity_families?: string[] | null;
  };
  const filtered = (rows ?? [])
    .filter((r: FundingListRow) => !dismissedOppIds.has(r.id))
    .filter((r: FundingListRow) =>
      fundingListRowMatchesScope(fundingListRowScope(r, today), scope)
    );

  const addDays = (base: Date, days: number) => new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  const inDays = (iso: string | null, days: number) => {
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    return d >= today && d <= addDays(today, days);
  };
  const postedWithinDays = (iso: string | null, days: number) => {
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    return d >= addDays(today, -days) && d <= addDays(today, 1);
  };
  const isImmunologyTranslationalFit = (row: FundingListRow) =>
    /immun|inflamm|translat/i.test(`${row.title} ${row.activity_families?.join(" ") ?? ""}`);

  function statusRank(bucket: FundingListRowBucket): number {
    if (bucket === "forecasted") return 0;
    if (bucket === "open") return 1;
    return 2;
  }

  const sorted = [...filtered];
  if (sortKey === "status") {
    sorted.sort((a, b) => {
      const ra = statusRank(
        fundingListRowScope(
          { status: a.status, close_date: a.close_date, forecasted: a.forecasted },
          today
        )
      );
      const rb = statusRank(
        fundingListRowScope(
          { status: b.status, close_date: b.close_date, forecasted: b.forecasted },
          today
        )
      );
      if (ra !== rb) {
        return asc ? ra - rb : rb - ra;
      }
      return String(a.title ?? "").localeCompare(String(b.title ?? ""));
    });
  }

  const sortedByPostedDesc = [...sorted].sort((a, b) => {
    const ad = a.posted_date ? new Date(a.posted_date).getTime() : 0;
    const bd = b.posted_date ? new Date(b.posted_date).getTime() : 0;
    return bd - ad;
  });
  const savedOppIdsOnPage = new Set<string>();
  const savedOppIdsAll = new Set<string>();
  if (user) {
    const savedAllRes = await supabase
      .from("saved_funding_opportunities")
      .select("opportunity_id")
      .eq("user_id", user.id)
      .limit(DEFAULT_MAX_NOFOS_PER_SYNC);
    for (const row of savedAllRes.data ?? []) {
      if (row.opportunity_id) savedOppIdsAll.add(row.opportunity_id);
    }
  }

  const tabbed = (() => {
    if (activeTab === "all") return sorted;
    if (activeTab === "recommended") {
      return [...sorted]
        .filter((row) => isRecommendedMatch(row, inDays))
        .sort((a, b) => scoreRecommendation(b, inDays) - scoreRecommendation(a, inDays));
    }
    if (activeTab === "closing_soon") {
      const horizon = parseClosingDays(searchParams) ?? 90;
      return sorted.filter((row) => inDays(row.close_date, horizon));
    }
    if (activeTab === "new_this_week") {
      const lookback = parsePostedDays(searchParams) ?? 7;
      return sortedByPostedDesc.filter((row) => postedWithinDays(row.posted_date, lookback));
    }
    if (activeTab === "large_awards") return sorted.filter((row) => looksLargeCollaborativeGrant(row));
    if (activeTab === "esi_career") return sorted.filter((row) => isEsiCareerDevelopment(row));
    if (activeTab === "investigator_initiated") return sorted.filter((row) => isInvestigatorInitiated(row));
    if (activeTab === "foundations") return sorted.filter((row) => isFoundationOpportunity(row));
    if (activeTab === "immunology_translational")
      return sorted.filter((row) => isImmunologyTranslationalFit(row));
    if (activeTab === "saved") return sorted.filter((row) => savedOppIdsAll.has(row.id));
    return sorted;
  })();

  const totalFiltered = tabbed.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / perPage));
  const effectivePage = Math.min(Math.max(1, requestedPage), totalPages);
  const pageSlice = tabbed.slice(
    (effectivePage - 1) * perPage,
    (effectivePage - 1) * perPage + perPage
  );

  const matchedOppIdsOnPage = new Set<string>();
  const savedSearchLinks: SavedSearchLink[] = [];
  let rdsgOwners: Awaited<ReturnType<typeof fetchActiveRdsgOwnersForAlerts>> = [];
  if (user) {
    const sliceIds = pageSlice.map((o) => o.id);
    const [searchesRes, onPageRes, matchedOnPageRes, rdsgOwnerRows] = await Promise.all([
      fetchSavedFundingSearchesForUser(supabase, user.id, 25),
      sliceIds.length > 0
        ? supabase
            .from("saved_funding_opportunities")
            .select("opportunity_id")
            .eq("user_id", user.id)
            .in("opportunity_id", sliceIds)
        : Promise.resolve({ data: [] as { opportunity_id: string }[], error: null }),
      sliceIds.length > 0
        ? supabase
            .from("saved_opportunity_pi_matches")
            .select("opportunity_id")
            .eq("user_id", user.id)
            .in("opportunity_id", sliceIds)
        : Promise.resolve({ data: [] as { opportunity_id: string }[], error: null }),
      fetchActiveRdsgOwnersForAlerts(supabase),
    ]);

    rdsgOwners = rdsgOwnerRows;

    const searchRows = searchesRes.rows;
    const matchStats = await Promise.all(
      searchRows.map(async (row) => {
        const r = row as {
          state: unknown;
          last_viewed_at?: string | null;
          alert_forecasted_notices?: boolean | null;
        };
        const st = parseSavedFundingListState(r.state);
        if (!st) {
          return { newMatchesSinceViewed: 0, newResultsRecent: 0, lastMatchedAt: null as string | null };
        }
        return getSavedSearchMatchStats(supabase, st, {
          lastViewedAt: r.last_viewed_at ?? null,
          includeForecasted: r.alert_forecasted_notices !== false,
        });
      })
    );

    for (let i = 0; i < searchRows.length; i += 1) {
      const row = searchRows[i]!;
      const r = row as {
        id: string;
        name: string;
        state: unknown;
        email_notifications_enabled?: boolean | null;
        alert_frequency?: string | null;
        alert_forecasted_notices?: boolean | null;
        alert_rdsg_owner_ids?: string[] | null;
        last_viewed_at?: string | null;
        last_matched_at?: string | null;
      };
      const st = parseSavedFundingListState(r.state);
      const stats = matchStats[i]!;
      const frequency =
        r.alert_frequency === "instant" || r.alert_frequency === "daily" || r.alert_frequency === "weekly"
          ? r.alert_frequency
          : "weekly";
      savedSearchLinks.push({
        id: r.id,
        name: String(r.name ?? "Saved search"),
        href: st ? fundingListHref(st) : "/funding-opportunities",
        filterSummary: st ? formatSavedSearchFilterSummary(st) : "All opportunities",
        emailNotificationsEnabled: Boolean(r.email_notifications_enabled),
        alertFrequency: frequency,
        alertForecastedNotices: r.alert_forecasted_notices !== false,
        alertRdsgOwnerIds: Array.isArray(r.alert_rdsg_owner_ids) ? r.alert_rdsg_owner_ids : [],
        createdAt: (row as { created_at?: string | null }).created_at ?? null,
        updatedAt: (row as { updated_at?: string | null }).updated_at ?? null,
        lastViewedAt: r.last_viewed_at ?? null,
        lastMatchedAt: stats.lastMatchedAt ?? r.last_matched_at ?? null,
        newMatchesSinceViewed: stats.newMatchesSinceViewed,
        newResultsRecent: stats.newResultsRecent,
      });
    }

    for (const row of onPageRes.data ?? []) {
      if (row.opportunity_id) savedOppIdsOnPage.add(row.opportunity_id);
    }
    for (const row of matchedOnPageRes.data ?? []) {
      if (row.opportunity_id) matchedOppIdsOnPage.add(row.opportunity_id);
    }
  }

  const unscopedRows = (rows ?? []) as FundingListRow[];

  const openCount = unscopedRows.filter((row) => fundingListRowScope(row, today) === "open").length;
  const forecastedCount = unscopedRows.filter((row) => fundingListRowScope(row, today) === "forecasted").length;
  const activeInList = openCount + forecastedCount;
  const totalInList = unscopedRows.length;
  const hasListFilters = hasAgencyFilter || qParam.trim().length > 0 || rdFiltersActive(rdFilterState);
  const totalOpportunities = hasListFilters ? totalInList : (fundingOppDbTotal ?? totalInList);

  const quickFilterCounts: FundingQuickFiltersCounts = {
    matched: unscopedRows.filter((row) => isRecommendedMatch(row, inDays)).length,
    saved: unscopedRows.filter((row) => savedOppIdsAll.has(row.id)).length,
    closing: {
      d30: unscopedRows.filter((row) => inDays(row.close_date, 30)).length,
      d60: unscopedRows.filter((row) => inDays(row.close_date, 60)).length,
      d90: unscopedRows.filter((row) => inDays(row.close_date, 90)).length,
    },
    scope: {
      all: activeInList,
      open: openCount,
      forecasted: forecastedCount,
    },
    new: {
      week: unscopedRows.filter((row) => postedWithinDays(row.posted_date, 7)).length,
      month: unscopedRows.filter((row) => postedWithinDays(row.posted_date, 30)).length,
      quarter: unscopedRows.filter((row) => postedWithinDays(row.posted_date, 90)).length,
    },
    esi: unscopedRows.filter((row) => isEsiCareerDevelopment(row)).length,
    collaborative: unscopedRows.filter((row) => looksLargeCollaborativeGrant(row)).length,
    investigatorInitiated: unscopedRows.filter((row) => isInvestigatorInitiated(row)).length,
    foundations: unscopedRows.filter((row) => isFoundationOpportunity(row)).length,
  };

  const sortHrefs = Object.fromEntries(
    SORT_COLUMNS.map((column) => [
      column,
      buildFundingListUrl(searchParams, nextColumnSort(column, sortState), activeTab),
    ])
  ) as Record<FundingListSortKey, string>;

  const resultsTableRows: FundingListResultsRow[] = pageSlice.map((o) => {
    const row = o as FundingListRow;
    const bucket = fundingListRowScope(
      {
        status: row.status,
        close_date: row.close_date,
        forecasted: row.forecasted,
      },
      today
    );
    const closingUrgency: 30 | 60 | 90 | null = inDays(row.close_date, 30)
      ? 30
      : inDays(row.close_date, 60)
        ? 60
        : inDays(row.close_date, 90)
          ? 90
          : null;
    let closeDateLabel = formatDate(row.close_date);
    if (closingUrgency) {
      closeDateLabel = `${closeDateLabel} · ≤${closingUrgency}d`;
    }
    return {
      id: row.id,
      title: row.title,
      agencyDisplay: normalizeAgencyDisplayName(row.agency) ?? row.agency ?? "—",
      statusBucket: bucket,
      postedDate: row.posted_date,
      closeDate: row.close_date,
      closeDateLabel,
      closingUrgency,
      fundingInstrument: row.funding_instrument,
      activityFamilies: row.activity_families ?? null,
      sourceUrl: resolveFundingSourceUrl({
        source_system: row.source_system,
        source_opportunity_id: row.source_opportunity_id,
      }),
      initiallyBookmarked: savedOppIdsOnPage.has(row.id),
      isMatched: matchedOppIdsOnPage.has(row.id),
    };
  });

  return (
    <FundingOpportunityPeekProvider>
    <div className="mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col">
        <header className="mb-8 pt-2">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--fo-ink-muted)]">
            Prospera
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--fo-title)] sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
            Funding Opportunities
          </h1>
          <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-[var(--fo-ink-body)] sm:text-base">
            Search, filter, and track grants matched to your research
          </p>
        </header>

        <div className="mb-6">
          <FundingListKeywordSearch editorial />
        </div>

        <FundingChatPanel />

        <div className="flex min-h-0 flex-1 flex-col gap-8 md:flex-row md:items-start md:gap-8 lg:gap-10 xl:gap-12">
          <div className="order-2 min-h-0 min-w-0 flex-1 space-y-8 md:order-1">
            {rdFiltersSkippedMigration || !listIncludesActivityFamilies ? (
              <div className="rounded-xl border border-[var(--fo-border)] border-l-[3px] border-l-[var(--fo-brand)] bg-[var(--fo-paper)] px-5 py-5 text-sm font-medium leading-relaxed text-[var(--fo-ink-body)] shadow-[var(--fo-shadow-surface)]">
                <p className="text-[0.95rem] font-bold tracking-tight text-[var(--fo-title)]">
                  Research triage data is not fully available
                </p>
                <p className="mt-2 text-[0.8125rem] font-medium text-[var(--fo-ink-body)]">
                  The database may be missing heuristic columns (for example{" "}
                  <code className="rounded-[12px] bg-[var(--fo-paper)] px-2 py-0.5 text-[0.7rem] font-semibold text-[var(--fo-title)] ring-1 ring-[var(--fo-border)]">
                    activity_families
                  </code>
                  ). Apply migration{" "}
                  <code className="rounded-[12px] bg-[var(--fo-paper)] px-2 py-0.5 text-[0.7rem] font-semibold text-[var(--fo-title)] ring-1 ring-[var(--fo-border)]">
                    20260418100000_funding_opportunities_rd_signals.sql
                  </code>{" "}
                  from{" "}
                  <code className="rounded-[12px] bg-[var(--fo-paper)] px-2 py-0.5 text-[0.7rem] font-semibold text-[var(--fo-title)] ring-1 ring-[var(--fo-border)]">
                    supabase/migrations/
                  </code>{" "}
                  in the Supabase SQL editor or via{" "}
                  <code className="rounded-[12px] bg-[var(--fo-paper)] px-2 py-0.5 text-[0.7rem] font-semibold text-[var(--fo-title)] ring-1 ring-[var(--fo-border)]">
                    supabase db push
                  </code>
                  , then run <strong className="font-bold text-[var(--fo-title)]">Extract features</strong> or a Simpler
                  sync.{" "}
                  {rdFiltersSkippedMigration ? "Your research triage filters were skipped for this request." : null}{" "}
                  {!listIncludesActivityFamilies
                    ? "The activity family column is hidden until those columns exist."
                    : null}{" "}
                  The table still uses keywords, agency, and opportunity scope.
                </p>
              </div>
            ) : null}

            {error ? (
              <p className="text-sm text-red-700/90">{error.message}</p>
            ) : (
              <section className="fo-panel">
                <div className="overflow-hidden rounded-t-[var(--fo-radius-lg)] border-b border-[var(--fo-border)] bg-[var(--fo-paper)] px-5 py-3 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-bold tracking-tight text-[var(--fo-title)]">
                      Results{" "}
                        <span className="font-semibold tabular-nums text-[var(--fo-interaction)]">({totalFiltered})</span>
                      <span className="ml-2 text-sm font-normal text-[var(--fo-ink-muted)]">
                        {totalOpportunities.toLocaleString()} total · {openCount.toLocaleString()} open ·{" "}
                        {forecastedCount.toLocaleString()} forecasted
                      </span>
                    </h2>
                    <p className="text-xs font-medium text-[var(--fo-ink-muted)]">
                      Sort by column headers · {perPage} per page
                    </p>
                  </div>
                </div>

                <Suspense fallback={null}>
                  <FundingListToolbar
                    counts={quickFilterCounts}
                    savedSearches={savedSearchLinks}
                    showSavedSearches={!!user}
                    rdsgOwners={rdsgOwners}
                  />
                </Suspense>

                {totalFiltered === 0 ? (
                  <div className="overflow-hidden rounded-b-[var(--fo-radius-lg)] px-5 py-8">
                    <EmptyState
                      title="No funding opportunities"
                      className="rounded-xl border border-dashed border-[var(--fo-border)] bg-[var(--fo-paper)]"
                      description={
                        (rows?.length ?? 0) > 0
                          ? "Nothing in this view matches your filters. Try changing opportunity scope."
                          : hasAgencyFilter
                            ? "No stored notices for the selected departments. Clear filters or choose broader departments."
                            : "Run a Simpler sync after setting the API key."
                      }
                    />
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-b-[var(--fo-radius-lg)]">
                <FundingListResultsTable
                  rows={resultsTableRows}
                  loggedIn={!!user}
                  listIncludesActivityFamilies={listIncludesActivityFamilies}
                  sortState={sortState}
                  sortHrefs={sortHrefs}
                />
                <FundingListPagination
                  totalFiltered={totalFiltered}
                  effectivePage={effectivePage}
                  perPage={perPage}
                  editorial
                />
                  </div>
                )}
              </section>
            )}

            <details className="fo-panel group overflow-hidden">
              <summary className="cursor-pointer list-none px-5 py-4 text-[0.8125rem] font-semibold text-inherit transition-colors marker:content-none [&::-webkit-details-marker]:hidden hover:opacity-90">
                <span className="select-none">Data sync & extraction</span>
              </summary>
              <div className="border-t border-[var(--fo-divider)] bg-[var(--fo-paper-2)] px-5 py-5">
                <SimplerSyncControls editorial />
                <p className="mt-4 text-[0.75rem] font-medium leading-relaxed text-[var(--fo-ink-body)]">
                  Requires{" "}
                  <code className="rounded-[12px] bg-[var(--fo-paper)] px-2 py-0.5 text-[0.7rem] font-semibold text-[var(--fo-title)] ring-1 ring-[var(--fo-border)]">
                    SIMPLER_GRANTS_API_KEY
                  </code>
                  . Each run requests up to {DEFAULT_MAX_NOFOS_PER_SYNC} posted or forecasted notices (closed and
                  archived are not pulled). Compare upserted count to the API total in the log when pagination
                  finishes.
                </p>
              </div>
            </details>
          </div>

          <aside className="order-1 w-full shrink-0 self-start md:order-2 md:w-[min(100%,20rem)] lg:w-[min(100%,21rem)] xl:w-80">
            <div className="fo-filter-rail overflow-hidden">
              <div className="fo-filter-rail-header px-5 py-5">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-inherit opacity-95">
                  Refine
                </p>
                <p className="mt-1 text-[0.8125rem] font-semibold leading-snug text-inherit">
                  Narrow your list
                </p>
                <p className="mt-1 text-[0.75rem] leading-snug text-inherit opacity-90">
                  Sort, agency scope, and research triage filters
                </p>
              </div>
              <div className="px-4 py-5 pb-6 sm:px-5">
                <FundingOpportunitiesFiltersPanel editorial />
                <FundingSearchBookmarksRail />
              </div>
            </div>
          </aside>
        </div>

        <FundingOpportunityPeekPanel loggedIn={!!user} />
    </div>
    </FundingOpportunityPeekProvider>
  );
}
