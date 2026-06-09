"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FundingQuickFiltersBar,
  type FundingQuickFiltersCounts,
} from "@/components/funding/funding-quick-filters-bar";
import {
  FundingSavedSearchContextBar,
  FundingSavedSearchesStrip,
  useActiveSavedSearch,
  type SavedSearchLink,
} from "@/components/funding/funding-saved-searches-strip";
import {
  fundingListDefaultHref,
  searchParamsToFundingListState,
  urlSearchParamsToRecord,
} from "@/lib/funding-opportunities/funding-list-url";
import { fundingListStateForBookmark } from "@/lib/funding-opportunities/saved-funding-list-state";
import type { RdsgOwnerRecipient } from "@/lib/funding-opportunities/saved-search-alert-recipients";
import { useSearchParams } from "next/navigation";

export function FundingListToolbar({
  counts,
  savedSearches,
  showSavedSearches,
  rdsgOwners,
}: {
  counts: FundingQuickFiltersCounts;
  savedSearches: SavedSearchLink[];
  showSavedSearches: boolean;
  rdsgOwners: RdsgOwnerRecipient[];
}) {
  const sp = useSearchParams();
  const router = useRouter();

  const currentState = useMemo(() => {
    const record = urlSearchParamsToRecord(new URLSearchParams(sp.toString()));
    return fundingListStateForBookmark(searchParamsToFundingListState(record));
  }, [sp]);

  const activeSearch = useActiveSavedSearch(savedSearches, currentState);
  const [openFlyoutId, setOpenFlyoutId] = useState<string | null>(null);
  const [loadedSavedSearchId, setLoadedSavedSearchId] = useState<string | null>(null);

  useEffect(() => {
    if (activeSearch) {
      setLoadedSavedSearchId(activeSearch.id);
    }
  }, [activeSearch]);

  return (
    <div className="relative z-20 border-b border-[var(--fo-divider)] bg-[var(--fo-paper-2)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 overflow-visible px-5 py-3 sm:px-6">
        <FundingQuickFiltersBar counts={counts} variant="embedded" />
        {showSavedSearches ? (
          <>
            <div
              className="hidden h-7 w-px shrink-0 bg-[var(--fo-border)] md:block"
              aria-hidden
            />
            <FundingSavedSearchesStrip
              savedSearches={savedSearches}
              rdsgOwners={rdsgOwners}
              currentState={currentState}
              openFlyoutId={openFlyoutId}
              setOpenFlyoutId={setOpenFlyoutId}
              loadedSavedSearchId={loadedSavedSearchId}
              setLoadedSavedSearchId={setLoadedSavedSearchId}
            />
          </>
        ) : null}
      </div>
      {activeSearch ? (
        <FundingSavedSearchContextBar
          search={activeSearch}
          onEdit={() => setOpenFlyoutId(activeSearch.id)}
          onClear={() => {
            setLoadedSavedSearchId(null);
            router.push(fundingListDefaultHref());
          }}
        />
      ) : null}
    </div>
  );
}
