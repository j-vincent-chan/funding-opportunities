"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  fundingListHref,
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
        router.replace(fundingListHref({ ...base, ...patch }), { scroll: false });
      });
    },
    [router]
  );
  return { navigate, isPending };
}
