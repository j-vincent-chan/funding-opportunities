"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markSavedFundingSearchViewedAction,
  saveFundingSearchAction,
} from "@/app/actions/funding-search-saves";
import { FundingSavedSearchFlyout } from "@/components/funding/funding-saved-search-flyout";
import {
  fundingListDefaultHref,
  type FundingListClientState,
} from "@/lib/funding-opportunities/funding-list-url";
import {
  savedSearchMatchesCurrentState,
  suggestSavedSearchName,
} from "@/lib/funding-opportunities/saved-funding-list-state";
import type { SavedSearchAlertFrequency } from "@/components/funding/funding-saved-search-flyout";
import type { RdsgOwnerRecipient } from "@/lib/funding-opportunities/saved-search-alert-recipients";

export type SavedSearchLink = {
  id: string;
  name: string;
  href: string;
  filterSummary?: string;
  emailNotificationsEnabled: boolean;
  alertFrequency: SavedSearchAlertFrequency;
  alertForecastedNotices: boolean;
  alertRdsgOwnerIds: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
  lastViewedAt?: string | null;
  lastMatchedAt?: string | null;
  newMatchesSinceViewed: number;
  newResultsRecent: number;
  totalMatches: number;
};

function SavedSearchesLabelIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="7" cy="7" r="4.25" />
      <path d="M10.5 10.5L14 14" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon({ alertsOn }: { alertsOn: boolean }) {
  return (
    <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center overflow-visible">
      <svg
        viewBox="0 0 16 16"
        className={[
          "block h-3.5 w-3.5 overflow-visible",
          alertsOn ? "text-[#0F6E56]" : "text-[var(--fo-ink-faint)]",
        ].join(" ")}
        fill={alertsOn ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M8 2a3.75 3.75 0 00-3.75 3.75v2.35L2.75 10.75h10.5L11.75 8.1V5.75A3.75 3.75 0 008 2z" />
        <path d="M7.25 11h1.5v1.75h-1.5V11z" />
      </svg>
    </span>
  );
}

export function isActiveSavedSearch(current: FundingListClientState, savedHref: string): boolean {
  return savedSearchMatchesCurrentState(current, savedHref);
}

function MatchCountBadge({ count, hasNew }: { count: number; hasNew?: boolean }) {
  if (count > 0) {
    return (
      <span
        className={[
          "shrink-0 rounded-full px-1.5 py-px text-[11px] font-bold leading-tight tabular-nums",
          hasNew ? "bg-[#EEEDFE] text-[#534AB7]" : "text-[var(--fo-ink-faint)]",
        ].join(" ")}
      >
        {count}
      </span>
    );
  }
  return (
    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[var(--fo-ink-faint)]">0</span>
  );
}

function EditSearchIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-[1.125rem] w-[1.125rem] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11.25 2.75l2 2-7.5 7.5H3.75v-2.5l7.5-7.5z" />
      <path d="M9.75 4.25l2 2" />
    </svg>
  );
}

export function FundingSavedSearchesStrip({
  savedSearches,
  rdsgOwners,
  currentState,
  openFlyoutId,
  setOpenFlyoutId,
  loadedSavedSearchId,
  setLoadedSavedSearchId,
}: {
  savedSearches: SavedSearchLink[];
  rdsgOwners: RdsgOwnerRecipient[];
  currentState: FundingListClientState;
  openFlyoutId: string | null;
  setOpenFlyoutId: (id: string | null) => void;
  loadedSavedSearchId: string | null;
  setLoadedSavedSearchId: (id: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [savingNew, setSavingNew] = useState(false);
  const [saveName, setSaveName] = useState("");
  const saveInputRef = useRef<HTMLInputElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (savingNew) saveInputRef.current?.focus();
  }, [savingNew]);

  const runSavedSearch = useCallback(
    (search: SavedSearchLink) => {
      setLoadedSavedSearchId(search.id);
      startTransition(async () => {
        await markSavedFundingSearchViewedAction(search.id);
        router.push(search.href);
        router.refresh();
      });
    },
    [router, setLoadedSavedSearchId]
  );

  const toggleEditFlyout = useCallback(
    (search: SavedSearchLink) => {
      if (isActiveSavedSearch(currentState, search.href)) {
        setLoadedSavedSearchId(search.id);
      }
      setOpenFlyoutId(openFlyoutId === search.id ? null : search.id);
    },
    [currentState, openFlyoutId, setLoadedSavedSearchId, setOpenFlyoutId]
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
  }, [currentState, router, saveName, setOpenFlyoutId]);

  return (
    <div ref={stripRef} className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="mr-0.5 inline-flex shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[var(--fo-interaction)]">
          <SavedSearchesLabelIcon />
          Saved Searches
        </span>

        {savedSearches.map((search) => {
          const active = isActiveSavedSearch(currentState, search.href);
          const flyoutOpen = openFlyoutId === search.id;
          return (
            <div
              key={search.id}
              className="relative"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div
                className={[
                  "inline-flex max-w-[15rem] items-stretch overflow-hidden rounded-[22px] border text-[14px] font-medium leading-snug transition-colors",
                  active || flyoutOpen
                    ? "border-[#534AB7] bg-[#EEEDFE] text-[#3C3489]"
                    : "border-[var(--fo-border)] bg-[var(--fo-paper)] text-[var(--fo-ink-muted)]",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => runSavedSearch(search)}
                  className={[
                    "inline-flex min-w-0 flex-1 items-center gap-2 rounded-l-[22px] px-3 py-1.5 transition-colors",
                    active || flyoutOpen
                      ? "text-[#3C3489] hover:bg-[#E4E2FC]"
                      : "hover:bg-[var(--fo-row-hover)] hover:text-[var(--fo-title)]",
                  ].join(" ")}
                  title={`Run “${search.name}”`}
                >
                  <BellIcon alertsOn={search.emailNotificationsEnabled} />
                  <span className="min-w-0 truncate">{search.name}</span>
                  <MatchCountBadge
                    count={search.totalMatches}
                    hasNew={search.newMatchesSinceViewed > 0}
                  />
                </button>
                <button
                  type="button"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleEditFlyout(search);
                  }}
                  className={[
                    "inline-flex shrink-0 items-center justify-center self-stretch rounded-r-[22px] border-l px-3 transition-colors",
                    active || flyoutOpen
                      ? "border-[#534AB7]/30 text-[#3C3489] hover:bg-[#E4E2FC]"
                      : "border-[var(--fo-border)] text-[var(--fo-ink-body)] hover:bg-[var(--fo-row-hover)] hover:text-[var(--fo-title)]",
                  ].join(" ")}
                  title={`Edit search “${search.name}”`}
                  aria-label={`Edit search “${search.name}”`}
                  aria-expanded={flyoutOpen}
                >
                  <EditSearchIcon />
                </button>
              </div>
              {flyoutOpen ? (
                <FundingSavedSearchFlyout
                  search={search}
                  rdsgOwners={rdsgOwners}
                  currentState={currentState}
                  canUpdateFilters={loadedSavedSearchId === search.id}
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
          <form
            className="inline-flex min-w-0 flex-wrap items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              submitNewSearch();
            }}
          >
            <input
              ref={saveInputRef}
              type="text"
              value={saveName}
              maxLength={120}
              placeholder="Search name"
              disabled={pending}
              aria-label="Saved search name"
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setSavingNew(false);
                  setSaveName("");
                }
              }}
              className="w-[10.5rem] min-w-[8rem] rounded-lg border border-[var(--fo-interaction)] bg-white px-[11px] py-[5px] text-[12px] font-semibold text-[var(--fo-title)] outline-none ring-0 placeholder:font-medium placeholder:text-[var(--fo-ink-muted)]"
            />
            <button
              type="submit"
              disabled={pending || !saveName.trim()}
              className="rounded-lg bg-[var(--fo-interaction)] px-2.5 py-[5px] text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setSavingNew(false);
                setSaveName("");
              }}
              className="rounded-lg px-1.5 py-[5px] text-[12px] font-semibold text-[var(--fo-ink-muted)] hover:text-[var(--fo-title)]"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setSavingNew(true);
              setSaveName(suggestSavedSearchName(currentState));
            }}
            className="inline-flex items-center gap-2 rounded-[22px] border border-dashed border-[var(--fo-border)] bg-transparent px-3 py-1.5 text-[14px] font-medium leading-snug text-[var(--fo-ink-muted)] transition-colors hover:border-[var(--fo-interaction)] hover:text-[var(--fo-title)] disabled:opacity-60"
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

function SavedSearchBookmarkIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-[#534AB7]" aria-hidden>
      <path
        d="M4 2.5h8v11l-4-2.5-4 2.5v-11z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FundingSavedSearchContextBar({
  search,
  onEdit,
  onClear,
}: {
  search: SavedSearchLink;
  onEdit: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b-[0.5px] border-[var(--fo-border)] bg-[#EEEDFE44] px-5 py-1.5 text-xs text-[var(--fo-ink-body)] sm:px-6">
      <SavedSearchBookmarkIcon />
      <span className="font-semibold text-[#3C3489]">{search.name}</span>
      {search.newMatchesSinceViewed > 0 ? (
        <span className="text-[var(--fo-ink-muted)]">
          · {search.newMatchesSinceViewed} new since your last visit
        </span>
      ) : null}
      <button
        type="button"
        onClick={onEdit}
        className="font-semibold text-[var(--fo-interaction)] hover:underline"
      >
        Edit search
      </button>
      <button
        type="button"
        onClick={onClear}
        className="font-semibold text-[var(--fo-interaction)] hover:underline"
      >
        Clear
      </button>
    </div>
  );
}
