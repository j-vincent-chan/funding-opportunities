import Link from "next/link";
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
  DEFAULT_FUNDING_LIST_PAGE,
  fundingListHref,
  fundingListHrefWithSortOverride,
  searchParamsToFundingListState,
  departmentSubsFromSearchParams,
  isDepartmentSubsEmpty,
  nextColumnSort,
  parseFundingListPagination,
  parseListSort,
  resolveListScope,
  type FundingListSortKey,
} from "@/lib/funding-opportunities/funding-list-url";
import { FundingListKeywordSearch } from "@/components/funding/funding-list-keyword-search";
import { FundingChatPanel } from "@/components/funding/funding-chat-panel";
import { FundingListPagination } from "@/components/funding/funding-list-pagination";
import { FundingOpportunitiesFiltersPanel } from "@/components/funding/funding-opportunities-filters-panel";
import { FundingInstrumentPills } from "@/components/funding/funding-instrument-pills";
import { ActivityFamilyPills } from "@/components/funding/activity-family-pills";
import { FundingOpportunityStatusPill } from "@/components/funding/funding-opportunity-status-pill";
import { normalizeAgencyDisplayName } from "@/lib/funding-opportunities/agency-display";
import { parseSavedFundingListState } from "@/lib/funding-opportunities/saved-funding-list-state";
import { FundingSearchBookmarksRail } from "@/components/funding/funding-search-bookmarks-rail";
import { SaveFundingOpportunityIconButton } from "@/components/funding/save-funding-opportunity-button";
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
  | "saved"
  | "immunology_translational";

const TAB_CONFIG: Array<{ id: OpportunityViewTab; label: string }> = [
  { id: "all", label: "All Opportunities" },
  { id: "recommended", label: "Recommended" },
  { id: "closing_soon", label: "Closing Soon" },
  { id: "new_this_week", label: "New This Week" },
  { id: "large_awards", label: "Large Awards" },
  { id: "immunology_translational", label: "Immunology / Translational" },
  { id: "saved", label: "Saved" },
];

function resolveOpportunityTab(searchParams: SearchParams): OpportunityViewTab {
  const raw = typeof searchParams.tab === "string" ? searchParams.tab : "";
  if (
    raw === "all" ||
    raw === "recommended" ||
    raw === "closing_soon" ||
    raw === "new_this_week" ||
    raw === "large_awards" ||
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

function SortColHeader({
  label,
  column,
  current,
  searchParams,
  nowrap = false,
  tab,
}: {
  label: string;
  column: FundingListSortKey;
  current: { key: FundingListSortKey; dir: "asc" | "desc" };
  searchParams: SearchParams;
  nowrap?: boolean;
  tab: OpportunityViewTab;
}) {
  const sortNext = nextColumnSort(column, current);
  const href = buildFundingListUrl(searchParams, sortNext, tab);
  const active = current.key === column;
  return (
    <th
      scope="col"
      className={`px-5 py-4 text-left align-bottom ${nowrap ? "whitespace-nowrap" : ""}`}
    >
      <Link
        href={href}
        title="Sort by this column; click again to reverse"
        className={`inline-flex items-center gap-1 rounded-md px-1 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.1em] transition-colors ${
          active
            ? "border-b-2 border-[var(--fo-accent)] text-[var(--fo-title)]"
            : "border-b-2 border-transparent text-[var(--fo-ink-muted)] hover:border-[var(--fo-line-hover)] hover:text-[var(--fo-interaction)]"
        } hover:bg-black/[0.03]`}
      >
        {label}
        {active ? (
          <span className="font-semibold text-[var(--fo-accent)] tabular-nums" aria-hidden>
            {current.dir === "asc" ? "↑" : "↓"}
          </span>
        ) : null}
      </Link>
    </th>
  );
}

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
  const todayIso = new Date().toISOString().slice(0, 10);

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
    "id, title, agency, agency_code, close_date, posted_date, funding_instrument, status, forecasted";
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

  const [countResult, activeCountResult, firstList] = await Promise.all([
    supabase.from("funding_opportunities").select("id", { count: "exact", head: true }),
    supabase
      .from("funding_opportunities")
      .select("id", { count: "exact", head: true })
      .or(`close_date.is.null,close_date.gte.${todayIso}`)
      .not("status", "in", "(closed,archived)")
      .or("forecasted.is.null,forecasted.eq.false"),
    initialListPromise,
  ]);

  const fundingOppDbTotal = countResult.count;
  const globalActiveListings = activeCountResult.count ?? 0;

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
    activity_families?: string[] | null;
  };
  const filtered = (rows ?? []).filter((r: FundingListRow) =>
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
  const looksLargeAward = (row: FundingListRow) => {
    const text = `${row.title ?? ""} ${row.funding_instrument ?? ""}`.toLowerCase();
    return (
      /cooperative|center|program project|p\d{2}|u\d{2}|u54|multi-project|consortium|million|\$1m/.test(
        text
      ) || row.funding_instrument?.startsWith("U") === true || row.funding_instrument?.startsWith("P") === true
    );
  };
  const isImmunologyTranslationalFit = (row: FundingListRow) =>
    /immun|inflamm|translat/i.test(`${row.title} ${row.activity_families?.join(" ") ?? ""}`);
  const recommendationScore = (row: FundingListRow) => {
    const text = `${row.title ?? ""} ${row.activity_families?.join(" ") ?? ""}`.toLowerCase();
    let score = 0;
    if (/immun|inflamm|translat|clinical/.test(text)) score += 3;
    if (inDays(row.close_date, 90)) score += 2;
    if (row.status === "open") score += 1;
    if (looksLargeAward(row)) score += 1;
    return score;
  };

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
        .filter((row) => recommendationScore(row) >= 3)
        .sort((a, b) => recommendationScore(b) - recommendationScore(a));
    }
    if (activeTab === "closing_soon") return sorted.filter((row) => inDays(row.close_date, 90));
    if (activeTab === "new_this_week") return sortedByPostedDesc.filter((row) => postedWithinDays(row.posted_date, 7));
    if (activeTab === "large_awards") return sorted.filter((row) => looksLargeAward(row));
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

  const savedSearchLinks: {
    id: string;
    name: string;
    href: string;
    emailNotificationsEnabled: boolean;
    createdAt?: string | null;
    updatedAt?: string | null;
    newMatchesSinceViewed?: number;
  }[] = [];
  if (user) {
    const sliceIds = pageSlice.map((o) => o.id);
    const [searchesRes, onPageRes] = await Promise.all([
      supabase
        .from("saved_funding_searches")
        .select("id, name, state, created_at, updated_at, email_notifications_enabled")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(25),
      sliceIds.length > 0
        ? supabase
            .from("saved_funding_opportunities")
            .select("opportunity_id")
            .eq("user_id", user.id)
            .in("opportunity_id", sliceIds)
        : Promise.resolve({ data: [] as { opportunity_id: string }[], error: null }),
    ]);

    for (const row of searchesRes.data ?? []) {
      const r = row as {
        id: string;
        name: string;
        state: unknown;
        email_notifications_enabled?: boolean | null;
      };
      const st = parseSavedFundingListState(r.state);
      savedSearchLinks.push({
        id: r.id,
        name: String(r.name ?? "Saved search"),
        href: st ? fundingListHref(st) : "/funding-opportunities",
        emailNotificationsEnabled: Boolean(r.email_notifications_enabled),
        createdAt: (row as { created_at?: string | null }).created_at ?? null,
        updatedAt: (row as { updated_at?: string | null }).updated_at ?? null,
        newMatchesSinceViewed: 0,
      });
    }

    for (const row of onPageRes.data ?? []) {
      if (row.opportunity_id) savedOppIdsOnPage.add(row.opportunity_id);
    }
  }

  const tabHref = (tab: OpportunityViewTab) => {
    const state = searchParamsToFundingListState(searchParams);
    return fundingListHref({
      ...state,
      tab,
      page: DEFAULT_FUNDING_LIST_PAGE,
    });
  };

  const intelligenceStats: Array<{
    id: string;
    label: string;
    value: string;
    tone?: "warn" | "ok";
    tab?: OpportunityViewTab;
  }> = [
    { id: "active", label: "Total active opportunities", value: globalActiveListings.toLocaleString() },
    {
      id: "new-week",
      label: "New opportunities this week",
      value: sorted.filter((row) => postedWithinDays(row.posted_date, 7)).length.toLocaleString(),
      tone: "ok",
      tab: "new_this_week",
    },
    {
      id: "closing-30",
      label: "Closing in 30 days",
      value: sorted.filter((row) => inDays(row.close_date, 30)).length.toLocaleString(),
      tone: "warn",
      tab: "closing_soon",
    },
    {
      id: "closing-60",
      label: "Closing in 60 days",
      value: sorted.filter((row) => inDays(row.close_date, 60)).length.toLocaleString(),
    },
    {
      id: "closing-90",
      label: "Closing in 90 days",
      value: sorted.filter((row) => inDays(row.close_date, 90)).length.toLocaleString(),
    },
    {
      id: "forecasted",
      label: "Forecasted opportunities",
      value: sorted.filter((row) => fundingListRowScope(row, today) === "forecasted").length.toLocaleString(),
    },
    {
      id: "cooperative",
      label: "Cooperative agreements",
      value: sorted.filter((row) => /cooperative|u01|u54/i.test(`${row.title} ${row.funding_instrument ?? ""}`)).length.toLocaleString(),
    },
    {
      id: "large-awards",
      label: "Large strategic awards",
      value: sorted.filter((row) => looksLargeAward(row)).length.toLocaleString(),
      tab: "large_awards",
    },
    {
      id: "nih",
      label: "NIH opportunities",
      value: sorted.filter((row) => /nih|nci|niaid|niddk|nhlbi/i.test(`${row.agency ?? ""} ${row.agency_code ?? ""}`)).length.toLocaleString(),
    },
    {
      id: "topic-fit",
      label: "Immunology / inflammation / translational",
      value: sorted.filter((row) => isImmunologyTranslationalFit(row)).length.toLocaleString(),
      tone: "ok",
      tab: "immunology_translational",
    },
  ];

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col">
        <header className="mb-8 pt-2">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--fo-ink-muted)]">
            Prospera
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--fo-title)] sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
            Funding intelligence workspace
          </h1>
          <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-[var(--fo-ink-body)] sm:text-base">
            Discover → Narrow → Ask → Save → Act. Search notices, interpret fit with Prospera, and move quickly to
            action.
          </p>
        </header>

        <div className="mb-6">
          <FundingListKeywordSearch editorial />
        </div>

        <div className="mb-8">
          <FundingChatPanel />
        </div>

        <section className="fo-panel mb-8 overflow-hidden">
          <div className="border-b border-[var(--fo-border)] bg-[var(--fo-paper)] px-5 py-4 sm:px-6">
            <h2 className="text-lg font-bold tracking-tight text-[var(--fo-title)]">Opportunity Intelligence</h2>
            <p className="mt-1 text-xs font-medium text-[var(--fo-ink-muted)]">
              A snapshot of what is active, urgent, and strategically relevant.
            </p>
          </div>
          <div className="grid gap-3 bg-[var(--fo-paper-2)] px-4 py-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            {intelligenceStats.map((item) => (
              <Link
                key={item.id}
                href={item.tab ? tabHref(item.tab) : "#"}
                className={`rounded-xl border border-[var(--fo-border)] bg-[var(--fo-paper)] px-3 py-2 ${
                  item.tab ? "transition-colors hover:border-[var(--fo-line-hover)] hover:bg-[var(--fo-paper-2)]" : "pointer-events-none"
                }`}
                aria-disabled={!item.tab}
              >
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--fo-ink-muted)]">
                  {item.label}
                </p>
                <p
                  className={`mt-1 text-xl font-semibold ${
                    item.tone === "warn"
                      ? "text-amber-700"
                      : item.tone === "ok"
                        ? "text-emerald-700"
                        : "text-[var(--fo-title)]"
                  }`}
                >
                  {item.value}
                </p>
              </Link>
            ))}
          </div>
        </section>

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
            ) : totalFiltered === 0 ? (
              <EmptyState
                title="No funding opportunities"
                className="rounded-xl border border-dashed border-[var(--fo-border)] bg-[var(--fo-paper)] shadow-[var(--fo-shadow-surface)]"
                description={
                  (rows?.length ?? 0) > 0
                    ? "Nothing in this view matches your filters. Try changing opportunity scope."
                    : hasAgencyFilter
                      ? "No stored notices for the selected departments. Clear filters or choose broader departments."
                      : "Run a Simpler sync after setting the API key."
                }
              />
            ) : (
              <section className="fo-panel overflow-hidden">
                <div className="border-b-2 border-[var(--fo-border)] bg-[var(--fo-paper)] px-5 py-4 sm:px-6 sm:py-5">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-[var(--fo-title)]">
                        Results{" "}
                        <span className="font-semibold tabular-nums text-[var(--fo-interaction)]">({totalFiltered})</span>
                      </h2>
                      <p className="mt-1 text-xs font-medium text-[var(--fo-ink-muted)]">
                        Sort by column headers. {perPage} rows per page
                        {fundingOppDbTotal != null ? (
                          <>
                            {" "}
                            · <span className="tabular-nums">{fundingOppDbTotal}</span> total in database
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {TAB_CONFIG.map((tab) => {
                      const active = activeTab === tab.id;
                      return (
                        <Link
                          key={tab.id}
                          href={tabHref(tab.id)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            active
                              ? "border-[var(--fo-interaction)] bg-[var(--fo-select-tint)] text-[var(--fo-title)]"
                              : "border-[var(--fo-border)] bg-[var(--fo-paper)] text-[var(--fo-ink-muted)] hover:border-[var(--fo-line-hover)] hover:text-[var(--fo-title)]"
                          }`}
                        >
                          {tab.label}
                        </Link>
                      );
                    })}
                  </div>
                  {fundingOppDbTotal != null ? (
                    <details className="mt-3 rounded-lg border-2 border-[var(--fo-border)] bg-[var(--fo-paper-2)] px-3 py-2 text-[0.75rem] text-[var(--fo-ink-body)]">
                      <summary className="cursor-pointer font-semibold text-[var(--fo-title)] hover:text-[var(--fo-interaction)]">
                        How this list is loaded
                      </summary>
                      <p className="mt-2 leading-relaxed">
                        Filters and sort apply to up to{" "}
                        <span className="tabular-nums font-semibold text-[var(--fo-ink-body)]">{DEFAULT_MAX_NOFOS_PER_SYNC}</span>{" "}
                        matching rows from{" "}
                        <code className="rounded-md bg-[var(--fo-paper-2)] px-1.5 py-0.5 text-[0.7rem] font-semibold text-[var(--fo-title)]">
                          funding_opportunities
                        </code>
                        ; the table below is paginated.
                      </p>
                    </details>
                  ) : null}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left">
                    <thead className="fo-funding-results-thead">
                      <tr>
                        {user ? (
                          <th
                            scope="col"
                            className="w-10 px-2 py-4 pb-3 text-left text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--fo-table-head-fg)]"
                          >
                            <span className="sr-only">Save</span>
                          </th>
                        ) : null}
                        <SortColHeader
                          label="Title"
                          column="title"
                          current={sortState}
                          searchParams={searchParams}
                          tab={activeTab}
                        />
                        <SortColHeader
                          label="Agency"
                          column="agency"
                          current={sortState}
                          searchParams={searchParams}
                          tab={activeTab}
                        />
                        <SortColHeader
                          label="Status"
                          column="status"
                          current={sortState}
                          searchParams={searchParams}
                          tab={activeTab}
                        />
                        <SortColHeader
                          label="Posted"
                          column="posted_date"
                          current={sortState}
                          searchParams={searchParams}
                          nowrap
                          tab={activeTab}
                        />
                        <SortColHeader
                          label="Close"
                          column="close_date"
                          current={sortState}
                          searchParams={searchParams}
                          nowrap
                          tab={activeTab}
                        />
                        <SortColHeader
                          label="Instrument"
                          column="funding_instrument"
                          current={sortState}
                          searchParams={searchParams}
                          tab={activeTab}
                        />
                        {listIncludesActivityFamilies ? (
                          <th
                            scope="col"
                            className="px-5 py-4 pb-3 text-left text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--fo-table-head-fg)]"
                          >
                            Activity family
                          </th>
                        ) : null}
                        <th
                          scope="col"
                          className="px-5 py-4 pb-3 text-left text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--fo-table-head-fg)]"
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageSlice.map((o) => {
                        const bucket = fundingListRowScope(
                          {
                            status: o.status,
                            close_date: o.close_date,
                            forecasted: o.forecasted,
                          },
                          today
                        );
                        return (
                          <tr
                            key={o.id}
                            className="fo-funding-results-row group border-b transition-colors last:border-b-0 hover:bg-[var(--fo-row-hover)]"
                          >
                            {user ? (
                              <td className="w-10 px-2 py-5 align-top">
                                <SaveFundingOpportunityIconButton
                                  opportunityId={o.id}
                                  initiallySaved={savedOppIdsOnPage.has(o.id)}
                                />
                              </td>
                            ) : null}
                            <td className="min-w-0 max-w-[min(100%,22rem)] px-5 py-5 align-top sm:max-w-[min(100%,28rem)] lg:max-w-[min(100%,36rem)] xl:max-w-none xl:min-w-[12rem]">
                              <Link
                                href={`/funding-opportunities/${o.id}`}
                                className="block text-[1.02rem] font-semibold leading-snug tracking-tight text-[var(--fo-title)] underline-offset-[6px] [overflow-wrap:anywhere] hover:text-[var(--fo-interaction)] hover:underline"
                              >
                                {o.title}
                              </Link>
                            </td>
                            <td className="px-5 py-5 align-top text-sm font-medium leading-snug text-[var(--fo-ink-body)]">
                              {normalizeAgencyDisplayName(o.agency) ?? o.agency ?? "—"}
                            </td>
                            <td className="px-5 py-5 align-top whitespace-nowrap">
                              <FundingOpportunityStatusPill status={bucket} />
                            </td>
                            <td className="whitespace-nowrap px-5 py-5 align-top tabular-nums text-sm font-medium text-[var(--fo-ink-muted)]">
                              {formatDate(o.posted_date)}
                            </td>
                            <td className="whitespace-nowrap px-5 py-5 align-top tabular-nums text-sm font-medium text-[var(--fo-ink-muted)]">
                              <div className="space-y-1">
                                <p>{formatDate(o.close_date)}</p>
                                {inDays(o.close_date, 30) ? (
                                  <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-800">
                                    Closing within 30 days
                                  </span>
                                ) : inDays(o.close_date, 60) ? (
                                  <span className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-[0.65rem] font-semibold text-yellow-800">
                                    Closing within 60 days
                                  </span>
                                ) : inDays(o.close_date, 90) ? (
                                  <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[0.65rem] font-semibold text-sky-800">
                                    Closing within 90 days
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-5 py-5 align-top text-sm font-medium text-[var(--fo-ink-body)]">
                              <FundingInstrumentPills value={o.funding_instrument} />
                            </td>
                            {listIncludesActivityFamilies ? (
                              <td className="px-5 py-5 align-top text-sm font-medium text-[var(--fo-ink-body)]">
                                <ActivityFamilyPills families={o.activity_families} />
                              </td>
                            ) : null}
                            <td className="px-5 py-5 align-top">
                              <div className="flex flex-wrap gap-1 opacity-100 transition-opacity xl:opacity-0 xl:group-hover:opacity-100">
                                <Link
                                  href={`/funding-opportunities/${o.id}`}
                                  className="rounded-md border border-[var(--fo-border)] px-2 py-1 text-[0.7rem] font-semibold text-[var(--fo-ink-body)] hover:border-[var(--fo-line-hover)] hover:text-[var(--fo-title)]"
                                >
                                  View
                                </Link>
                                <Link
                                  href={`/match/quick?q=${encodeURIComponent(o.title)}`}
                                  className="rounded-md border border-[var(--fo-border)] px-2 py-1 text-[0.7rem] font-semibold text-[var(--fo-ink-body)] hover:border-[var(--fo-line-hover)] hover:text-[var(--fo-title)]"
                                >
                                  Match
                                </Link>
                                <Link
                                  href={`mailto:?subject=${encodeURIComponent(`Funding opportunity: ${o.title}`)}&body=${encodeURIComponent(`Review this opportunity: /funding-opportunities/${o.id}`)}`}
                                  className="rounded-md border border-[var(--fo-border)] px-2 py-1 text-[0.7rem] font-semibold text-[var(--fo-ink-body)] hover:border-[var(--fo-line-hover)] hover:text-[var(--fo-title)]"
                                >
                                  Share
                                </Link>
                                <Link
                                  href={`/funding-opportunities/${o.id}`}
                                  className="rounded-md border border-[var(--fo-border)] px-2 py-1 text-[0.7rem] font-semibold text-[var(--fo-ink-body)] hover:border-[var(--fo-line-hover)] hover:text-[var(--fo-title)]"
                                >
                                  Not relevant
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <FundingListPagination
                  totalFiltered={totalFiltered}
                  effectivePage={effectivePage}
                  perPage={perPage}
                  editorial
                />
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
                <Suspense
                  fallback={
                    <div className="mt-6 border-t border-[var(--fo-divider)] pt-5 text-[0.75rem] text-[var(--fo-ink-muted)]">
                      Loading saved items…
                    </div>
                  }
                >
                  <FundingSearchBookmarksRail loggedIn={!!user} savedSearches={savedSearchLinks} />
                </Suspense>
              </div>
            </div>
          </aside>
        </div>
    </div>
  );
}
