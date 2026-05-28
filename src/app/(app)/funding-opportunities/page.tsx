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
  fundingListHref,
  fundingListHrefWithSortOverride,
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

function buildFundingListUrl(
  current: SearchParams,
  next: { sort: string; order: "asc" | "desc" }
): string {
  return fundingListHrefWithSortOverride(current, next.sort, next.order);
}

function SortColHeader({
  label,
  column,
  current,
  searchParams,
  nowrap = false,
}: {
  label: string;
  column: FundingListSortKey;
  current: { key: FundingListSortKey; dir: "asc" | "desc" };
  searchParams: SearchParams;
  nowrap?: boolean;
}) {
  const sortNext = nextColumnSort(column, current);
  const href = buildFundingListUrl(searchParams, sortNext);
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

  const totalFiltered = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / perPage));
  const effectivePage = Math.min(Math.max(1, requestedPage), totalPages);
  const pageSlice = sorted.slice(
    (effectivePage - 1) * perPage,
    (effectivePage - 1) * perPage + perPage
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const savedSearchLinks: { id: string; name: string; href: string; emailNotificationsEnabled: boolean }[] = [];
  const savedOppIdsOnPage = new Set<string>();

  if (user) {
    const sliceIds = pageSlice.map((o) => o.id);
    const [searchesRes, onPageRes] = await Promise.all([
      supabase
        .from("saved_funding_searches")
        .select("id, name, state, created_at, email_notifications_enabled")
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
      });
    }

    for (const row of onPageRes.data ?? []) {
      if (row.opportunity_id) savedOppIdsOnPage.add(row.opportunity_id);
    }
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col">
        <header className="mb-8 pt-2">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--fo-ink-muted)]">
            Prospera
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--fo-title)] sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
            Find funding opportunities
          </h1>
          <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-[var(--fo-ink-body)] sm:text-base">
            Search notices from Simpler.Grants.gov, narrow with <strong className="font-semibold text-[var(--fo-title)]">Refine</strong>, then open a row for
            details.
          </p>
        </header>

        <div className="mb-6">
          <FundingListKeywordSearch editorial />
        </div>

        <div className="mb-8">
          <FundingChatPanel />
        </div>

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
            ) : sorted.length === 0 ? (
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
                        <span className="font-semibold tabular-nums text-[var(--fo-interaction)]">({sorted.length})</span>
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
                        />
                        <SortColHeader
                          label="Agency"
                          column="agency"
                          current={sortState}
                          searchParams={searchParams}
                        />
                        <SortColHeader
                          label="Status"
                          column="status"
                          current={sortState}
                          searchParams={searchParams}
                        />
                        <SortColHeader
                          label="Posted"
                          column="posted_date"
                          current={sortState}
                          searchParams={searchParams}
                          nowrap
                        />
                        <SortColHeader
                          label="Close"
                          column="close_date"
                          current={sortState}
                          searchParams={searchParams}
                          nowrap
                        />
                        <SortColHeader
                          label="Instrument"
                          column="funding_instrument"
                          current={sortState}
                          searchParams={searchParams}
                        />
                        {listIncludesActivityFamilies ? (
                          <th
                            scope="col"
                            className="px-5 py-4 pb-3 text-left text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--fo-table-head-fg)]"
                          >
                            Activity family
                          </th>
                        ) : null}
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
                            className="fo-funding-results-row border-b transition-colors last:border-b-0"
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
                              {formatDate(o.close_date)}
                            </td>
                            <td className="px-5 py-5 align-top text-sm font-medium text-[var(--fo-ink-body)]">
                              <FundingInstrumentPills value={o.funding_instrument} />
                            </td>
                            {listIncludesActivityFamilies ? (
                              <td className="px-5 py-5 align-top text-sm font-medium text-[var(--fo-ink-body)]">
                                <ActivityFamilyPills families={o.activity_families} />
                              </td>
                            ) : null}
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
