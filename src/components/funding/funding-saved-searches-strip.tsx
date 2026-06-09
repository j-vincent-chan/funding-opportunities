"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  markSavedFundingSearchViewedAction,
  saveFundingSearchAction,
} from "@/app/actions/funding-search-saves";
import { FundingSavedSearchFlyout } from "@/components/funding/funding-saved-search-flyout";
import {
  fundingListDefaultHref,
  fundingListHref,
  searchParamsToFundingListState,
  urlSearchParamsToRecord,
  type FundingListClientState,
} from "@/lib/funding-opportunities/funding-list-url";
import { fundingListStateForBookmark } from "@/lib/funding-opportunities/saved-funding-list-state";
import type { SavedSearchAlertFrequency } from "@/components/funding/funding-saved-search-flyout";

export type SavedSearchLink = {
  id: string;
  name: string;
  href: string;
  emailNotificationsEnabled: boolean;
  alertFrequency: SavedSearchAlertFrequency;
  alertForecastedNotices: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastViewedAt?: string | null;
  lastMatchedAt?: string | null;
  newMatchesSinceViewed: number;
  newResultsRecent: number;
};

function BellIcon({ alertsOn }: { alertsOn: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={[
        "h-3.5 w-3.5 shrink-0",
        alertsOn ? "text-[#0F6E56]" : "text-[var(--fo-ink-faint)]",
      ].join(" ")}
      fill={alertsOn ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={alertsOn ? 0 : 1.5}
      aria-hidden
    >
      {alertsOn ? (
        <path d="M8 1.5a4.25 4.25 0 00-4.25 4.25v2.1L2.5 10.5h11L12.25 7.85V5.75A4.25 4.25 0 008 1.5zm-1 11.25h2V13H7v-.25z" />
      ) : (
        <path
          d="M8 2a3.75 3.75 0 00-3.75 3.75v2.35L2.75 10.75h10.5L11.75 8.1V5.75A3.75 3.75 0 008 2zm-.75 10h1.5V13h-1.5v-1z"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function isActiveSavedSearch(current: FundingListClientState, savedHref: string): boolean {
  const queryString = savedHref.includes("?") ? (savedHref.split("?")[1] ?? "") : "";
  const savedState = fundingListStateForBookmark(
    searchParamsToFundingListState(urlSearchParamsToRecord(new URLSearchParams(queryString)))
  );
  const bookmarked = fundingListStateForBookmark(current);
  return fundingListHref(savedState) === fundingListHref(bookmarked);
}

function MatchCountBadge({ count }: { count: number }) {
  if (count > 0) {
    return (
      <span className="shrink-0 rounded-full bg-[#E1F5EE] px-1.5 py-px text-[11px] font-bold leading-tight text-[#0F6E56]">
        {count}
      </span>
    );
  }
  return (
    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[var(--fo-ink-faint)]">0</span>
  );
}

export function FundingSavedSearchesStrip({ savedSearches }: { savedSearches: SavedSearchLink[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openFlyoutId, setOpenFlyoutId] = useState<string | null>(null);
  const [savingNew, setSavingNew] = useState(false);
  const [saveName, setSaveName] = useState("");
  const saveInputRef = useRef<HTMLInputElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const currentState = useMemo(() => {
    const record = urlSearchParamsToRecord(new URLSearchParams(sp.toString()));
    return fundingListStateForBookmark(searchParamsToFundingListState(record));
  }, [sp]);

  useEffect(() => {
    if (savingNew) saveInputRef.current?.focus();
  }, [savingNew]);

  const loadSearch = useCallback(
    (search: SavedSearchLink) => {
      setOpenFlyoutId(search.id);
      startTransition(async () => {
        await markSavedFundingSearchViewedAction(search.id);
        router.push(search.href);
        router.refresh();
      });
    },
    [router]
  );

  const submitNewSearch = useCallback(() => {
    const name = saveName.trim();
    if (!name) {
      setSavingNew(false);
      return;
    }
    startTransition(async () => {
      const result = await saveFundingSearchAction({
        name,
        state: currentState,
        emailNotificationsEnabled: false,
        alertFrequency: "weekly",
        alertForecastedNotices: true,
      });
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
      setSavingNew(false);
      setSaveName("");
      setOpenFlyoutId(result.id);
      router.refresh();
    });
  }, [currentState, router, saveName]);

  return (
    <div ref={stripRef} className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:flex-initial">
        <span className="mr-0.5 shrink-0 text-xs font-semibold text-[var(--fo-ink-muted)]">Searches</span>

        {savedSearches.map((search) => {
          const active = isActiveSavedSearch(currentState, search.href);
          const flyoutOpen = openFlyoutId === search.id;
          return (
            <div
              key={search.id}
              className="relative"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  if (active && flyoutOpen) {
                    setOpenFlyoutId(null);
                    return;
                  }
                  loadSearch(search);
                }}
                className={[
                  "inline-flex max-w-[15rem] items-center gap-1.5 rounded-lg border px-[11px] py-[5px] text-[12px] font-semibold leading-none transition-colors",
                  active || flyoutOpen
                    ? "border-[#534AB7] bg-[#EEEDFE] text-[#3C3489]"
                    : "border-[var(--fo-border)] bg-[var(--fo-paper)] text-[var(--fo-ink-muted)] hover:border-[var(--fo-interaction)] hover:text-[var(--fo-title)]",
                ].join(" ")}
                title={search.name}
                aria-expanded={flyoutOpen}
              >
                <BellIcon alertsOn={search.emailNotificationsEnabled} />
                <span className="min-w-0 truncate">{search.name}</span>
                <MatchCountBadge count={search.newMatchesSinceViewed} />
              </button>
              {flyoutOpen ? (
                <FundingSavedSearchFlyout
                  search={search}
                  onClose={() => setOpenFlyoutId(null)}
                  onDeleted={() => {
                    setOpenFlyoutId(null);
                    if (active) router.replace(fundingListDefaultHref());
                    router.refresh();
                  }}
                  onSaved={() => router.refresh()}
                />
              ) : null}
            </div>
          );
        })}

        {savingNew ? (
          <input
            ref={saveInputRef}
            type="text"
            value={saveName}
            maxLength={120}
            placeholder="Search name"
            disabled={pending}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitNewSearch();
              }
              if (e.key === "Escape") {
                setSavingNew(false);
                setSaveName("");
              }
            }}
            onBlur={() => {
              if (!saveName.trim()) setSavingNew(false);
            }}
            className="w-[9.5rem] rounded-lg border border-dashed border-[var(--fo-interaction)] bg-white px-[11px] py-[5px] text-[12px] font-semibold text-[var(--fo-title)] outline-none ring-0 placeholder:font-medium placeholder:text-[var(--fo-ink-muted)]"
          />
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setSavingNew(true);
              setSaveName("");
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-[var(--fo-border)] bg-transparent px-[11px] py-[5px] text-[12px] font-semibold text-[var(--fo-ink-muted)] transition-colors hover:border-[var(--fo-interaction)] hover:text-[var(--fo-title)] disabled:opacity-60"
          >
            + Save this search
          </button>
        )}
    </div>
  );
}

export function useActiveSavedSearch(
  savedSearches: SavedSearchLink[],
  currentState: FundingListClientState
): SavedSearchLink | null {
  return savedSearches.find((search) => isActiveSavedSearch(currentState, search.href)) ?? null;
}

export function FundingSavedSearchContextBar({
  search,
  onClear,
}: {
  search: SavedSearchLink;
  onClear: () => void;
}) {
  return (
    <div className="border-b-[0.5px] border-[var(--fo-border)] bg-[#EEEDFE44] px-5 py-2 text-xs text-[var(--fo-ink-body)] sm:px-6">
      <span>
        Showing results for <strong className="font-semibold text-[#3C3489]">{search.name}</strong>
        {" · "}
        {search.newMatchesSinceViewed} new since your last visit
        {" · "}
        <button
          type="button"
          onClick={onClear}
          className="font-semibold text-[var(--fo-interaction)] hover:underline"
        >
          Clear
        </button>
      </span>
    </div>
  );
}
