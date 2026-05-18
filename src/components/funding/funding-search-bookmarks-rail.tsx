"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  deleteSavedFundingSearchAction,
  saveFundingSearchAction,
  setSavedFundingSearchEmailNotificationsAction,
} from "@/app/actions/funding-search-saves";
import { Button } from "@/components/ui/button";
import { searchParamsToFundingListState, urlSearchParamsToRecord } from "@/lib/funding-opportunities/funding-list-url";
import { fundingListStateForBookmark } from "@/lib/funding-opportunities/saved-funding-list-state";

export type SavedSearchLink = {
  id: string;
  name: string;
  href: string;
  emailNotificationsEnabled: boolean;
};

export function FundingSearchBookmarksRail({
  loggedIn,
  savedSearches,
}: {
  loggedIn: boolean;
  savedSearches: SavedSearchLink[];
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const [saveName, setSaveName] = useState("My search");
  const [notifyOnSave, setNotifyOnSave] = useState(false);
  const [pendingSave, startSave] = useTransition();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingNotifyId, setPendingNotifyId] = useState<string | null>(null);

  const currentState = useMemo(() => {
    const record = urlSearchParamsToRecord(new URLSearchParams(sp.toString()));
    return fundingListStateForBookmark(searchParamsToFundingListState(record));
  }, [sp]);

  if (!loggedIn) {
    return (
      <div className="mt-6 border-t border-[var(--fo-divider)] pt-5 text-[0.8125rem] leading-snug text-[var(--fo-ink-body)]">
        <p className="font-semibold text-[var(--fo-title)]">Saved searches</p>
        <p className="mt-2">
          <Link href="/login" className="font-semibold text-[var(--fo-interaction)] underline">
            Sign in
          </Link>{" "}
          to save filters and email alerts. Starred notices live under{" "}
          <Link href="/match/saved" className="font-semibold text-[var(--fo-interaction)] underline">
            Match → Opportunity pipeline
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6 border-t border-[var(--fo-divider)] pt-5">
      <section>
        <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--fo-teal)]">
          Saved searches
        </h3>
        <p className="mt-1 text-[0.75rem] leading-snug text-[var(--fo-ink-muted)]">
          Store keyword, scope, sort, departments, and triage filters. Restoring opens page 1.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            maxLength={120}
            placeholder="Name this search"
            className="w-full rounded-md border border-[var(--fo-border)] bg-[var(--fo-paper)] px-2.5 py-1.5 text-xs font-medium text-[var(--fo-title)] placeholder:text-[var(--fo-ink-muted)]"
          />
          <label className="flex cursor-pointer items-start gap-2 text-[0.75rem] font-medium leading-snug text-[var(--fo-ink-body)]">
            <input
              type="checkbox"
              checked={notifyOnSave}
              onChange={(e) => setNotifyOnSave(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-[var(--fo-border)]"
            />
            <span>
              Email me when <strong className="font-semibold text-[var(--fo-title)]">posted</strong> or{" "}
              <strong className="font-semibold text-[var(--fo-title)]">forecasted</strong> notices match this search
              (requires Resend + cron on the server).
            </span>
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={pendingSave}
            className="w-full border-[var(--fo-border)] bg-[var(--fo-paper)] text-xs font-semibold text-[var(--fo-title)]"
            onClick={() => {
              startSave(async () => {
                const r = await saveFundingSearchAction({
                  name: saveName,
                  state: currentState,
                  emailNotificationsEnabled: notifyOnSave,
                });
                if (!r.ok) {
                  window.alert(r.error);
                  return;
                }
                router.refresh();
              });
            }}
          >
            {pendingSave ? "Saving…" : "Save current search"}
          </Button>
        </div>
        <p className="mt-3 text-[0.7rem] leading-snug text-[var(--fo-ink-muted)]">
          Alerts consider notices whose row was updated in the last ~72 hours, deduplicated per notice. Schedule{" "}
          <code className="rounded bg-[var(--fo-paper)] px-1 py-0.5 text-[0.65rem]">POST /api/cron/funding-search-notifications</code>{" "}
          with <code className="rounded bg-[var(--fo-paper)] px-1 py-0.5 text-[0.65rem]">CRON_SECRET</code>.
        </p>
        {savedSearches.length === 0 ? (
          <p className="mt-2 text-[0.75rem] text-[var(--fo-ink-muted)]">No saved searches yet.</p>
        ) : (
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-0.5">
            {savedSearches.map((s) => (
              <li
                key={s.id}
                className="rounded-md border border-[var(--fo-border)] bg-[var(--fo-paper-2)] px-2 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={s.href}
                    className="min-w-0 flex-1 text-left text-[0.8125rem] font-semibold leading-snug text-[var(--fo-interaction)] underline-offset-2 hover:underline"
                  >
                    {s.name}
                  </Link>
                  <button
                    type="button"
                    className="shrink-0 text-[0.7rem] font-semibold text-[var(--fo-ink-muted)] hover:text-red-700"
                    disabled={pendingDeleteId === s.id}
                    title="Delete saved search"
                    onClick={() => {
                      setPendingDeleteId(s.id);
                      void (async () => {
                        const r = await deleteSavedFundingSearchAction(s.id);
                        setPendingDeleteId(null);
                        if (!r.ok) window.alert(r.error);
                        else router.refresh();
                      })();
                    }}
                  >
                    {pendingDeleteId === s.id ? "…" : "Remove"}
                  </button>
                </div>
                <label className="mt-2 flex cursor-pointer items-start gap-2 text-[0.7rem] font-medium leading-snug text-[var(--fo-ink-muted)]">
                  <input
                    type="checkbox"
                    checked={s.emailNotificationsEnabled}
                    disabled={pendingNotifyId === s.id}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setPendingNotifyId(s.id);
                      void (async () => {
                        const r = await setSavedFundingSearchEmailNotificationsAction({
                          savedSearchId: s.id,
                          enabled,
                        });
                        setPendingNotifyId(null);
                        if (!r.ok) {
                          window.alert(r.error);
                          return;
                        }
                        router.refresh();
                      })();
                    }}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-[var(--fo-border)]"
                  />
                  <span>Email alerts for new posted / forecasted matches</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[0.75rem] leading-snug text-[var(--fo-ink-muted)]">
        Curated notices:{" "}
        <Link href="/match/saved" className="font-semibold text-[var(--fo-interaction)] underline">
          Match → Opportunity pipeline
        </Link>
        .
      </p>
    </div>
  );
}
