"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  fundingListHref,
  isDepartmentSubsEmpty,
  searchParamsToFundingListState,
  urlSearchParamsToRecord,
  type FundingListClientState,
} from "@/lib/funding-opportunities/funding-list-url";

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
        const next: FundingListClientState = { ...base, ...patch };
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
        router.replace(fundingListHref(next), { scroll: false });
      });
    },
    [router]
  );
  return { navigate, isPending };
}
