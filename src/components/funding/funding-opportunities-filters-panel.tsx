"use client";

import { Suspense, useCallback, useEffect, useMemo } from "react";
import { PageLoadingState } from "@/components/ui/page-loading-state";
import { useRouter, useSearchParams } from "next/navigation";
import { CardBody, CardHeader } from "@/components/ui/card";
import { ResearchDevFiltersFields } from "@/components/funding/research-dev-filters-fields";
import { useFundingListNavigate } from "@/components/funding/use-funding-list-navigate";
import {
  DEFAULT_FUNDING_LIST_PAGE,
  defaultFundingListClientState,
  defaultSortDirForKey,
  fundingListDefaultHref,
  isDepartmentSubsEmpty,
  searchParamsToFundingListState,
  urlHasAgencyFilterParams,
  urlSearchParamsToRecord,
  type FundingListClientState,
  type FundingListSortKey,
} from "@/lib/funding-opportunities/funding-list-url";
import type { RdListFilterState } from "@/lib/funding-opportunities/rd-list-filters";

function FundingOpportunitiesFiltersPanelInner({ editorial = false }: { editorial?: boolean }) {
  const sp = useSearchParams();
  const router = useRouter();
  const { navigate, isPending } = useFundingListNavigate();

  const record = useMemo(() => urlSearchParamsToRecord(new URLSearchParams(sp.toString())), [sp]);
  const state = useMemo(() => searchParamsToFundingListState(record), [record]);

  useEffect(() => {
    if (urlHasAgencyFilterParams(record)) return;

    const hasDept =
      state.departments.length > 0 ||
      !isDepartmentSubsEmpty(state.departmentSubs) ||
      state.legacyAgencies.length > 0;
    if (hasDept || state.allDepartments) return;

    const defaults = defaultFundingListClientState();
    const patch: Partial<FundingListClientState> = {
      departments: defaults.departments,
      departmentSubs: defaults.departmentSubs,
      legacyAgencies: [],
      allDepartments: false,
      page: DEFAULT_FUNDING_LIST_PAGE,
    };
    if (!record.sort && !record.order) {
      patch.sort = defaults.sort;
      patch.order = defaults.order;
    }
    navigate(patch);
  }, [navigate, record, state.allDepartments, state.departments, state.departmentSubs, state.legacyAgencies]);

  const resetToDefaults = useCallback(() => {
    router.replace(fundingListDefaultHref(), { scroll: false });
  }, [router]);

  const patchRd = useCallback(
    (fn: (prev: RdListFilterState) => RdListFilterState) => {
      const params = new URLSearchParams(window.location.search.slice(1));
      const base = searchParamsToFundingListState(urlSearchParamsToRecord(params));
      const nextRd = fn(base.rd);
      const patch: Partial<FundingListClientState> = {
        rd: nextRd,
        page: DEFAULT_FUNDING_LIST_PAGE,
      };
      if (nextRd.nihIc.length > 0) {
        const depts = new Set(base.departments);
        depts.add("hhs");
        patch.departments = Array.from(depts);
        const nextSubs = { ...base.departmentSubs };
        const hhs = new Set(nextSubs.hhs ?? []);
        hhs.add("nih");
        nextSubs.hhs = Array.from(hhs);
        patch.departmentSubs = nextSubs;
        patch.legacyAgencies = [];
        patch.allDepartments = false;
      }
      navigate(patch);
    },
    [navigate]
  );

  const toggleDepartment = useCallback(
    (id: string, checked: boolean) => {
      const params = new URLSearchParams(window.location.search.slice(1));
      const base = searchParamsToFundingListState(urlSearchParamsToRecord(params));
      const set = new Set(base.departments);
      if (checked) set.add(id);
      else set.delete(id);
      const nextSubs = { ...base.departmentSubs };
      if (!checked) {
        delete nextSubs[id];
      }
      navigate({
        departments: Array.from(set),
        departmentSubs: nextSubs,
        legacyAgencies: [],
        allDepartments: false,
        page: DEFAULT_FUNDING_LIST_PAGE,
      });
    },
    [navigate]
  );

  const toggleDepartmentSub = useCallback(
    (deptId: string, subId: string, checked: boolean) => {
      const params = new URLSearchParams(window.location.search.slice(1));
      const base = searchParamsToFundingListState(urlSearchParamsToRecord(params));
      const nextSubs = { ...base.departmentSubs };
      const setH = new Set(nextSubs[deptId] ?? []);
      if (checked) setH.add(subId);
      else setH.delete(subId);
      if (setH.size === 0) {
        delete nextSubs[deptId];
      } else {
        nextSubs[deptId] = Array.from(setH);
      }
      const depts = new Set(base.departments);
      if (setH.size > 0) depts.add(deptId);
      navigate({
        departments: Array.from(depts),
        departmentSubs: nextSubs,
        legacyAgencies: [],
        allDepartments: false,
        page: DEFAULT_FUNDING_LIST_PAGE,
      });
    },
    [navigate]
  );

  const clearDepartmentFilter = useCallback(() => {
    navigate({
      departments: [],
      departmentSubs: {},
      legacyAgencies: [],
      allDepartments: true,
      page: DEFAULT_FUNDING_LIST_PAGE,
    });
  }, [navigate]);

  const sortLabel = editorial
    ? "block text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--fo-title)]"
    : "block text-slate-600";
  const sortSelect = editorial ? "fo-filter-input" : "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
  const sortHint = editorial
    ? "mt-2 text-[0.7rem] leading-relaxed text-[var(--fo-ink-body)]"
    : "mt-1 text-[0.65rem] text-slate-500";
  const foot = editorial
    ? "text-[0.7rem] leading-relaxed text-[var(--fo-ink-body)]"
    : "text-[0.7rem] leading-snug text-slate-500";

  const noDeptFilter =
    state.departments.length === 0 &&
    isDepartmentSubsEmpty(state.departmentSubs) &&
    state.legacyAgencies.length === 0;

  return (
    <div
      className={editorial ? "space-y-5 text-[0.8125rem] text-[var(--fo-ink-body)]" : "space-y-4 text-xs"}
      aria-busy={isPending || undefined}
      style={
        isPending
          ? { opacity: 0.88, transition: "opacity 120ms ease-out" }
          : { transition: "opacity 120ms ease-out" }
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p className={editorial ? "text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--fo-teal)]" : "text-xs font-semibold text-slate-700"}>
          Filters
        </p>
        <button
          type="button"
          onClick={resetToDefaults}
          className={
            editorial
              ? "shrink-0 text-[0.7rem] font-semibold text-[var(--fo-interaction)] underline-offset-2 hover:underline"
              : "shrink-0 text-[0.7rem] font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
          }
        >
          Reset to default
        </button>
      </div>

      <div>
        <label htmlFor="funding-sort" className={sortLabel}>
          Sort
        </label>
        <select
          id="funding-sort"
          value={state.sort}
          onChange={(e) => {
            const nextSort = e.target.value as FundingListSortKey;
            navigate({
              sort: nextSort,
              order: defaultSortDirForKey(nextSort),
              page: DEFAULT_FUNDING_LIST_PAGE,
            });
          }}
          className={sortSelect}
        >
          <option value="title">Title</option>
          <option value="agency">Agency</option>
          <option value="status">Status (forecasted → open → closed)</option>
          <option value="posted_date">Posted date</option>
          <option value="close_date">Close date</option>
          <option value="funding_instrument">Instrument</option>
        </select>
        <p className={sortHint}>
          Direction follows the table headers (↑ / ↓) when you click a column there.
        </p>
      </div>

      <ResearchDevFiltersFields
        scope={state.scope}
        onScopeChange={(next) => navigate({ scope: next, page: DEFAULT_FUNDING_LIST_PAGE })}
        rd={state.rd}
        patchRd={patchRd}
        departments={state.departments}
        departmentSubs={state.departmentSubs}
        legacyAgencies={state.legacyAgencies}
        toggleDepartment={toggleDepartment}
        toggleDepartmentSub={toggleDepartmentSub}
        clearDepartmentFilter={clearDepartmentFilter}
        noDepartmentFilter={noDeptFilter}
        editorial={editorial}
      />

      <p className={foot}>
        Filters apply as you change them. Opportunity scope defaults to{" "}
        <strong className="font-semibold text-[var(--fo-title)]">open + forecasted</strong> (excludes closed). Department
        defaults to HHS with NIH selected.
      </p>
    </div>
  );
}

export function FundingOpportunitiesFiltersPanel({ editorial = false }: { editorial?: boolean }) {
  return (
    <Suspense
      fallback={
        <PageLoadingState message="Loading filters…" compact className="px-1" />
      }
    >
      <FundingOpportunitiesFiltersPanelInner editorial={editorial} />
    </Suspense>
  );
}

export function FundingOpportunitiesFiltersCard({ editorial = false }: { editorial?: boolean }) {
  return (
    <>
      <CardHeader title="Filters & sort" />
      <CardBody>
        <FundingOpportunitiesFiltersPanel editorial={editorial} />
      </CardBody>
    </>
  );
}
