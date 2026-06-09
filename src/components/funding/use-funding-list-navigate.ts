"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
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
  } else if (
    patch.departments !== undefined ||
    patch.departmentSubs !== undefined ||
    patch.legacyAgencies !== undefined
  ) {
    const hasDept =
      (next.departments?.length ?? 0) > 0 ||
      !isDepartmentSubsEmpty(next.departmentSubs) ||
      (next.legacyAgencies?.length ?? 0) > 0;
    if (hasDept) next.allDepartments = false;
  }
  return next;
}

/**
 * URL updates for the funding list. Uses startTransition so the UI stays responsive
 * while the App Router fetches the next server-rendered page.
 */
export function useFundingListNavigate(): {
  navigate: (patch: Partial<FundingListClientState>) => void;
  isPending: boolean;
} {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const navigate = useCallback(
    (patch: Partial<FundingListClientState>) => {
      startTransition(() => {
        const params = new URLSearchParams(window.location.search.slice(1));
        const base = searchParamsToFundingListState(urlSearchParamsToRecord(params));
        const next = mergeFundingListClientState(base, patch);
        router.replace(fundingListHref(next), { scroll: false });
      });
    },
    [router]
  );
  return { navigate, isPending };
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
