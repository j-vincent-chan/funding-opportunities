"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_FUNDING_LIST_PAGE,
  defaultSidebarFilterPatch,
  fundingListHref,
  isDepartmentSubsEmpty,
  searchParamsToFundingListState,
  urlSearchParamsToRecord,
  type FundingListClientState,
} from "@/lib/funding-opportunities/funding-list-url";

export function mergeFundingListClientState(
  base: FundingListClientState,
  patch: Partial<FundingListClientState>
): FundingListClientState {
  const next: FundingListClientState = { ...base, ...patch };
  if (patch.rd !== undefined) next.rd = patch.rd;
  if (patch.allDepartments === true) {
    next.allDepartments = true;
    next.noDepartmentsSelected = false;
  } else if (patch.allDepartments === false) {
    next.allDepartments = false;
  }
  if (patch.noDepartmentsSelected === true) {
    next.noDepartmentsSelected = true;
    next.allDepartments = false;
  } else if (patch.noDepartmentsSelected === false) {
    next.noDepartmentsSelected = false;
  }
  if (
    patch.departments !== undefined ||
    patch.departmentSubs !== undefined ||
    patch.legacyAgencies !== undefined
  ) {
    const hasDept =
      (next.departments?.length ?? 0) > 0 ||
      !isDepartmentSubsEmpty(next.departmentSubs) ||
      (next.legacyAgencies?.length ?? 0) > 0;
    if (hasDept) {
      next.allDepartments = false;
      next.noDepartmentsSelected = false;
    }
  }
  return next;
}

/**
 * URL updates for the funding list. Uses startTransition so the UI stays responsive
 * while the App Router fetches the next server-rendered page.
 */
export function useFundingListNavigate(): {
  navigate: (
    patch: Partial<FundingListClientState>,
    options?: { resetSidebar?: boolean }
  ) => void;
  isPending: boolean;
} {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const navigate = useCallback(
    (patch: Partial<FundingListClientState>, options?: { resetSidebar?: boolean }) => {
      startTransition(() => {
        const params = new URLSearchParams(window.location.search.slice(1));
        const base = searchParamsToFundingListState(urlSearchParamsToRecord(params));
        let next = mergeFundingListClientState(base, patch);
        if (options?.resetSidebar && !next.savedSearchId) {
          next = mergeFundingListClientState(next, defaultSidebarFilterPatch());
        }
        if (patch.page === undefined) {
          next.page = DEFAULT_FUNDING_LIST_PAGE;
        }
        router.replace(fundingListHref(next), { scroll: false });
      });
    },
    [router]
  );
  return { navigate, isPending };
}

/** Optimistic list state for quick filters and other URL-driven controls. */
export function useFundingListOptimisticState(): {
  state: FundingListClientState;
  commitNavigation: (
    patch: Partial<FundingListClientState>,
    options?: { resetSidebar?: boolean }
  ) => void;
  isPending: boolean;
} {
  const sp = useSearchParams();
  const { navigate, isPending } = useFundingListNavigate();
  const urlState = useMemo(
    () => searchParamsToFundingListState(urlSearchParamsToRecord(new URLSearchParams(sp.toString()))),
    [sp]
  );
  const [optimisticState, setOptimisticState] = useState<FundingListClientState | null>(null);
  const displayStateRef = useRef(urlState);
  displayStateRef.current = optimisticState ?? urlState;

  useEffect(() => {
    setOptimisticState(null);
  }, [sp]);

  const commitNavigation = useCallback(
    (patch: Partial<FundingListClientState>, options?: { resetSidebar?: boolean }) => {
      const base = displayStateRef.current;
      let next = mergeFundingListClientState(base, patch);
      if (options?.resetSidebar && !next.savedSearchId) {
        next = mergeFundingListClientState(next, defaultSidebarFilterPatch());
      }
      if (patch.page === undefined) {
        next.page = DEFAULT_FUNDING_LIST_PAGE;
      }
      displayStateRef.current = next;
      setOptimisticState(next);
      navigate(patch, options);
    },
    [navigate]
  );

  return {
    state: optimisticState ?? urlState,
    commitNavigation,
    isPending,
  };
}

/**
 * Funding list filter state with optimistic UI: checkboxes and selects update immediately
 * while URL navigation and server fetch run in the background.
 */
export function useFundingListFilterState(): {
  state: FundingListClientState;
  commitFilter: (patch: Partial<FundingListClientState>) => void;
  isPending: boolean;
} {
  const sp = useSearchParams();
  const { navigate, isPending } = useFundingListNavigate();
  const urlState = useMemo(
    () => searchParamsToFundingListState(urlSearchParamsToRecord(new URLSearchParams(sp.toString()))),
    [sp]
  );
  const [optimisticState, setOptimisticState] = useState<FundingListClientState | null>(null);
  const displayStateRef = useRef(urlState);
  displayStateRef.current = optimisticState ?? urlState;

  useEffect(() => {
    setOptimisticState(null);
  }, [sp]);

  const commitFilter = useCallback(
    (patch: Partial<FundingListClientState>) => {
      const base = displayStateRef.current;
      const next = mergeFundingListClientState(base, patch);
      displayStateRef.current = next;
      setOptimisticState(next);
      navigate(patch);
    },
    [navigate]
  );

  return {
    state: optimisticState ?? urlState,
    commitFilter,
    isPending,
  };
}
