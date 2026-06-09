"use client";

import { Suspense, useCallback, useEffect, useMemo } from "react";
import { PageLoadingState } from "@/components/ui/page-loading-state";
import { useRouter, useSearchParams } from "next/navigation";
import { CardBody, CardHeader } from "@/components/ui/card";
import { ResearchDevFiltersFields } from "@/components/funding/research-dev-filters-fields";
import {
  useFundingListFilterState,
  useFundingListNavigate,
} from "@/components/funding/use-funding-list-navigate";
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

function isNoDepartmentFilter(state: FundingListClientState): boolean {
  return (
    state.departments.length === 0 &&
    isDepartmentSubsEmpty(state.departmentSubs) &&
    state.legacyAgencies.length === 0
  );
}

function allDepartmentsSelectionExcept(
  excludeDeptId?: string,
  excludeSub?: { deptId: string; subId: string }
): Pick<FundingListClientState, "departments" | "departmentSubs"> {
  const departments: string[] = [];
  const departmentSubs: DepartmentSubsSelection = {};

  for (const dept of TOP_LEVEL_DEPARTMENTS) {
    if (excludeDeptId && dept.id === excludeDeptId) continue;
    departments.push(dept.id);
    const subs = getSubcomponentsForDepartment(dept.id);
    if (subs.length === 0) continue;

    let subIds = subs.map((sub) => sub.id);
    if (excludeSub && excludeSub.deptId === dept.id) {
      subIds = subIds.filter((id) => id !== excludeSub.subId);
    }
    if (subIds.length > 0) {
      departmentSubs[dept.id] = subIds;
    }
  }

  return { departments, departmentSubs };
}
import type { DepartmentSubsSelection } from "@/lib/funding-opportunities/agency-filter";
import { TOP_LEVEL_DEPARTMENTS } from "@/lib/funding-opportunities/agency-taxonomy";
import { getSubcomponentsForDepartment } from "@/lib/funding-opportunities/department-subcomponents";

function FundingOpportunitiesFiltersPanelInner({ editorial = false }: { editorial?: boolean }) {
  const sp = useSearchParams();
  const router = useRouter();
  const { state, commitFilter, isPending } = useFundingListFilterState();
  const { navigate } = useFundingListNavigate();

  const record = useMemo(() => urlSearchParamsToRecord(new URLSearchParams(sp.toString())), [sp]);
  const urlState = useMemo(() => searchParamsToFundingListState(record), [record]);

  useEffect(() => {
    if (urlHasAgencyFilterParams(record)) return;

    const hasDept =
      urlState.departments.length > 0 ||
      !isDepartmentSubsEmpty(urlState.departmentSubs) ||
      urlState.legacyAgencies.length > 0;
    if (hasDept || urlState.allDepartments) return;

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
  }, [
    navigate,
    record,
    urlState.allDepartments,
    urlState.departments,
    urlState.departmentSubs,
    urlState.legacyAgencies,
  ]);

  const resetToDefaults = useCallback(() => {
    router.replace(fundingListDefaultHref(), { scroll: false });
  }, [router]);

  const patchRd = useCallback(
    (fn: (prev: RdListFilterState) => RdListFilterState) => {
      const nextRd = fn(state.rd);
      const patch: Partial<FundingListClientState> = {
        rd: nextRd,
        page: DEFAULT_FUNDING_LIST_PAGE,
      };
      if (nextRd.nihIc.length > 0) {
        const depts = new Set(state.departments);
        depts.add("hhs");
        patch.departments = Array.from(depts);
        const nextSubs = { ...state.departmentSubs };
        const hhs = new Set(nextSubs.hhs ?? []);
        hhs.add("nih");
        nextSubs.hhs = Array.from(hhs);
        patch.departmentSubs = nextSubs;
        patch.legacyAgencies = [];
        patch.allDepartments = false;
      }
      commitFilter(patch);
    },
    [commitFilter, state.departments, state.departmentSubs, state.rd]
  );

  const toggleDepartment = useCallback(
    (id: string, checked: boolean) => {
      if (isNoDepartmentFilter(state) && !checked) {
        commitFilter({
          ...allDepartmentsSelectionExcept(id),
          legacyAgencies: [],
          allDepartments: false,
          page: DEFAULT_FUNDING_LIST_PAGE,
        });
        return;
      }

      const set = new Set(state.departments);
      const nextSubs = { ...state.departmentSubs };
      const subs = getSubcomponentsForDepartment(id);

      if (checked) {
        set.add(id);
        if (subs.length > 0) {
          nextSubs[id] = subs.map((c) => c.id);
        }
      } else {
        set.delete(id);
        delete nextSubs[id];
      }

      commitFilter({
        departments: Array.from(set),
        departmentSubs: nextSubs,
        legacyAgencies: [],
        allDepartments: false,
        page: DEFAULT_FUNDING_LIST_PAGE,
      });
    },
    [commitFilter, state]
  );

  const toggleDepartmentSub = useCallback(
    (deptId: string, subId: string, checked: boolean) => {
      if (isNoDepartmentFilter(state) && !checked) {
        commitFilter({
          ...allDepartmentsSelectionExcept(undefined, { deptId, subId }),
          legacyAgencies: [],
          allDepartments: false,
          page: DEFAULT_FUNDING_LIST_PAGE,
        });
        return;
      }

      const subs = getSubcomponentsForDepartment(deptId);
      const nextSubs = { ...state.departmentSubs };
      let setH = new Set(nextSubs[deptId] ?? []);

      if (setH.size === 0 && state.departments.includes(deptId) && subs.length > 0) {
        setH = new Set(subs.map((c) => c.id));
      }

      if (checked) setH.add(subId);
      else setH.delete(subId);

      const depts = new Set(state.departments);
      if (setH.size === 0) {
        delete nextSubs[deptId];
        depts.delete(deptId);
      } else {
        nextSubs[deptId] = Array.from(setH);
        depts.add(deptId);
      }

      commitFilter({
        departments: Array.from(depts),
        departmentSubs: nextSubs,
        legacyAgencies: [],
        allDepartments: false,
        page: DEFAULT_FUNDING_LIST_PAGE,
      });
    },
    [commitFilter, state]
  );

  const clearDepartmentFilter = useCallback(() => {
    commitFilter({
      departments: [],
      departmentSubs: {},
      legacyAgencies: [],
      allDepartments: true,
      page: DEFAULT_FUNDING_LIST_PAGE,
    });
  }, [commitFilter]);

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

  const noDeptFilter = isNoDepartmentFilter(state);

  return (
    <div
      className={editorial ? "space-y-5 text-[0.8125rem] text-[var(--fo-ink-body)]" : "space-y-4 text-xs"}
      aria-busy={isPending || undefined}
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
            commitFilter({
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
        onScopeChange={(next) => commitFilter({ scope: next, page: DEFAULT_FUNDING_LIST_PAGE })}
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
