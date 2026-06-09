"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  deleteSavedFundingSearchAction,
  sendSavedFundingSearchTestEmailAction,
  updateSavedFundingSearchSettingsAction,
} from "@/app/actions/funding-search-saves";
import { formatDate } from "@/lib/formatting/dates";
import {
  formatSavedSearchFilterSummary,
  savedSearchMatchesCurrentState,
} from "@/lib/funding-opportunities/saved-funding-list-state";
import type { FundingListClientState } from "@/lib/funding-opportunities/funding-list-url";
import type { RdsgOwnerRecipient } from "@/lib/funding-opportunities/saved-search-alert-recipients";
import type { SavedSearchLink } from "@/components/funding/funding-saved-searches-strip";

export type SavedSearchAlertFrequency = "instant" | "daily" | "weekly";

function ToggleSwitch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent px-0.5 transition-colors",
        checked ? "justify-end bg-[#0F6E56]" : "justify-start bg-[var(--fo-border)]",
        disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
    >
      <span
        aria-hidden
        className="pointer-events-none h-5 w-5 shrink-0 rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

function FrequencySegment({
  value,
  disabled,
  onChange,
}: {
  value: SavedSearchAlertFrequency;
  disabled?: boolean;
  onChange: (next: SavedSearchAlertFrequency) => void;
}) {
  const options: { id: SavedSearchAlertFrequency; label: string }[] = [
    { id: "instant", label: "Instant" },
    { id: "daily", label: "Daily" },
    { id: "weekly", label: "Weekly" },
  ];

  return (
    <div className="flex rounded-lg border border-[var(--fo-border)] bg-[var(--fo-paper)] p-0.5">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.id)}
            className={[
              "flex-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
              active
                ? "bg-[#EEEDFE] text-[#3C3489]"
                : "text-[var(--fo-ink-muted)] hover:text-[var(--fo-title)]",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function RdsgRecipientsSelect({
  owners,
  selectedIds,
  disabled,
  onChange,
}: {
  owners: RdsgOwnerRecipient[];
  selectedIds: string[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? owners.filter(
          (o) =>
            o.fullName.toLowerCase().includes(q) || (o.email?.toLowerCase().includes(q) ?? false)
        )
      : owners;
    return list.slice(0, 40);
  }, [owners, query]);

  const selectedOwners = useMemo(
    () => owners.filter((o) => selected.has(o.id)),
    [owners, selected]
  );

  const toggle = (id: string) => {
    if (selected.has(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const summary =
    selectedOwners.length === 0
      ? "Choose RDSG recipients…"
      : selectedOwners.length === 1
        ? selectedOwners[0]!.fullName
        : `${selectedOwners.length} RDSG recipients`;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--fo-border)] bg-[var(--fo-paper)] px-2.5 py-2 text-left text-xs font-medium text-[var(--fo-title)]",
          disabled ? "cursor-not-allowed opacity-50" : "hover:border-[var(--fo-interaction)]",
        ].join(" ")}
      >
        <span className="min-w-0 truncate">{summary}</span>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {selectedOwners.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {selectedOwners.map((owner) => (
            <button
              key={owner.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(owner.id)}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#534AB7]/30 bg-[#EEEDFE] px-2 py-0.5 text-[10px] font-semibold text-[#3C3489] hover:bg-[#E4E2FC]"
            >
              <span className="truncate">{owner.fullName}</span>
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[110] overflow-hidden rounded-lg border border-[var(--fo-border)] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
          <div className="border-b border-[var(--fo-divider)] p-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search RDSG…"
              className="w-full rounded-md border border-[var(--fo-border)] bg-[var(--fo-paper)] px-2 py-1.5 text-xs text-[var(--fo-title)]"
            />
          </div>
          <div className="max-h-40 overflow-y-auto" role="listbox" aria-multiselectable="true" aria-label="RDSG alert recipients">
            {visible.length === 0 ? (
              <p className="px-3 py-3 text-xs text-[var(--fo-ink-muted)]">No matches.</p>
            ) : (
              visible.map((owner) => (
                <label
                  key={owner.id}
                  className="flex cursor-pointer items-start gap-2 border-b border-[var(--fo-divider)]/60 px-3 py-2 last:border-0 hover:bg-[var(--fo-paper-2)]"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-[var(--fo-border)]"
                    checked={selected.has(owner.id)}
                    disabled={disabled}
                    onChange={() => toggle(owner.id)}
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-[var(--fo-title)]">{owner.fullName}</span>
                    <span className="block text-[10px] text-[var(--fo-ink-muted)]">
                      {owner.email ?? "No email on file"}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      ) : null}

      <p className="mt-1.5 text-[10px] leading-snug text-[var(--fo-ink-muted)]">
        Alerts go to selected RDSG inboxes. If none are selected, your profile email is used when available.
      </p>
    </div>
  );
}

export function FundingSavedSearchFlyout({
  search,
  rdsgOwners,
  currentState,
  canUpdateFilters,
  onClose,
  onDeleted,
  onSaved,
}: {
  search: SavedSearchLink;
  rdsgOwners: RdsgOwnerRecipient[];
  currentState: FundingListClientState;
  canUpdateFilters: boolean;
  onClose: () => void;
  onDeleted: () => void;
  onSaved: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(search.name);
  const [emailEnabled, setEmailEnabled] = useState(search.emailNotificationsEnabled);
  const [frequency, setFrequency] = useState<SavedSearchAlertFrequency>(search.alertFrequency);
  const [forecastedNotices, setForecastedNotices] = useState(search.alertForecastedNotices);
  const [alertRdsgOwnerIds, setAlertRdsgOwnerIds] = useState<string[]>(search.alertRdsgOwnerIds);

  const filtersMatchSaved = savedSearchMatchesCurrentState(currentState, search.href);
  const hasUnsavedFilterChanges = canUpdateFilters && !filtersMatchSaved;
  const displayedFilterSummary = canUpdateFilters
    ? formatSavedSearchFilterSummary(currentState)
    : search.filterSummary;

  useEffect(() => {
    setName(search.name);
    setEmailEnabled(search.emailNotificationsEnabled);
    setFrequency(search.alertFrequency);
    setForecastedNotices(search.alertForecastedNotices);
    setAlertRdsgOwnerIds(search.alertRdsgOwnerIds);
  }, [search]);

  const lastMatchedLabel = search.lastMatchedAt
    ? formatDate(search.lastMatchedAt.slice(0, 10))
    : "—";

  const saveSettings = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      window.alert("Name is required.");
      return;
    }

    startTransition(async () => {
      const result = await updateSavedFundingSearchSettingsAction({
        savedSearchId: search.id,
        name: trimmedName,
        ...(canUpdateFilters ? { state: currentState } : {}),
        emailNotificationsEnabled: emailEnabled,
        alertFrequency: frequency,
        alertForecastedNotices: forecastedNotices,
        alertRdsgOwnerIds,
      });
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
      onSaved();
    });
  };

  return (
    <div
      ref={panelRef}
      onMouseDown={(event) => event.stopPropagation()}
      className="absolute left-0 top-[calc(100%+6px)] z-[100] w-[min(20rem,calc(100vw-2rem))] max-w-[20rem] rounded-xl border border-[var(--fo-border)] bg-white p-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
      role="dialog"
      aria-label={`Edit saved search ${search.name}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--fo-ink-muted)]">
          Edit saved search
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={onClose}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[var(--fo-ink-muted)] transition-colors hover:bg-[var(--fo-paper-2)] hover:text-[var(--fo-title)]"
          aria-label="Close editor"
        >
          Close
        </button>
      </div>

      <label className="mt-2 block">
        <span className="text-[11px] font-semibold text-[var(--fo-ink-muted)]">Name</span>
        <input
          type="text"
          value={name}
          maxLength={120}
          disabled={pending}
          onChange={(e) => setName(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-[var(--fo-border)] bg-[var(--fo-paper)] px-2.5 py-2 text-sm font-semibold text-[var(--fo-title)] outline-none focus:border-[var(--fo-interaction)]"
        />
      </label>

      <div className="mt-3">
        <p className="text-[11px] font-semibold text-[var(--fo-ink-muted)]">Search &amp; filters</p>
        <p className="mt-1.5 text-[11px] leading-snug text-[var(--fo-ink-body)]">
          {canUpdateFilters
            ? "Change the keyword search, quick filters, sidebar filters, sort columns, or results-per-page on this page. Save to update this saved search."
            : "Click the search name to load results, then adjust filters on this page. Save to update this saved search."}
        </p>
        {displayedFilterSummary ? (
          <p className="mt-2 rounded-lg border border-[var(--fo-border)] bg-[var(--fo-paper)] px-2.5 py-2 text-[11px] leading-snug text-[var(--fo-ink-body)]">
            {displayedFilterSummary}
          </p>
        ) : (
          <p className="mt-2 text-[11px] italic text-[var(--fo-ink-muted)]">Default filters</p>
        )}
        {hasUnsavedFilterChanges ? (
          <p className="mt-1.5 text-[10px] font-medium text-[#0F6E56]">Unsaved filter changes</p>
        ) : null}
      </div>

      <p className="mt-2 text-[11px] leading-snug text-[var(--fo-ink-muted)]">
        Last matched {lastMatchedLabel} · {search.newResultsRecent} new result
        {search.newResultsRecent === 1 ? "" : "s"}
      </p>

      <div className="mt-3.5 border-t border-[var(--fo-divider)] pt-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--fo-ink-muted)]">
          Email alerts
        </p>
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-3">
          <span className="text-xs font-semibold text-[var(--fo-ink-body)]">Email alerts</span>
          <ToggleSwitch
            checked={emailEnabled}
            disabled={pending}
            onChange={setEmailEnabled}
            label="Email alerts"
          />

          {emailEnabled ? (
            <>
              <div className="col-span-2">
                <p className="text-[11px] font-semibold text-[var(--fo-ink-muted)]">Send to</p>
                <div className="mt-1.5">
                  <RdsgRecipientsSelect
                    owners={rdsgOwners}
                    selectedIds={alertRdsgOwnerIds}
                    disabled={pending}
                    onChange={setAlertRdsgOwnerIds}
                  />
                </div>
              </div>

              <div className="col-span-2">
                <p className="text-[11px] font-semibold text-[var(--fo-ink-muted)]">Frequency</p>
                <div className="mt-1.5">
                  <FrequencySegment value={frequency} disabled={pending} onChange={setFrequency} />
                </div>
              </div>

              <span className="col-span-2 text-[11px] font-semibold text-[var(--fo-ink-muted)]">Also alert for</span>

              <span className="text-xs text-[var(--fo-ink-muted)]">Forecasted notices</span>
              <ToggleSwitch
                checked={forecastedNotices}
                disabled={pending}
                onChange={setForecastedNotices}
                label="Forecasted notices"
              />
            </>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={saveSettings}
        className="mt-3.5 w-full rounded-lg bg-[var(--fo-interaction)] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--fo-interaction-hover)] disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>

      {emailEnabled ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const saveFirst = await updateSavedFundingSearchSettingsAction({
                savedSearchId: search.id,
                name: name.trim(),
                ...(canUpdateFilters ? { state: currentState } : {}),
                emailNotificationsEnabled: emailEnabled,
                alertFrequency: frequency,
                alertForecastedNotices: forecastedNotices,
                alertRdsgOwnerIds,
              });
              if (!saveFirst.ok) {
                window.alert(saveFirst.error);
                return;
              }
              const result = await sendSavedFundingSearchTestEmailAction(search.id);
              if (!result.ok) {
                window.alert(result.error);
                return;
              }
              window.alert(
                `Test email sent to ${result.recipientCount} recipient${result.recipientCount === 1 ? "" : "s"} (${result.matchCount} recent match${result.matchCount === 1 ? "" : "es"}).`
              );
              onSaved();
            });
          }}
          className="mt-2 w-full rounded-lg border border-[var(--fo-border)] bg-[var(--fo-paper)] px-3 py-2 text-xs font-semibold text-[var(--fo-interaction)] transition-colors hover:border-[var(--fo-interaction)] disabled:opacity-60"
        >
          Send test email
        </button>
      ) : null}

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Delete saved search “${search.name}”?`)) return;
          startTransition(async () => {
            const result = await deleteSavedFundingSearchAction(search.id);
            if (!result.ok) {
              window.alert(result.error);
              return;
            }
            onDeleted();
          });
        }}
        className="mt-2.5 w-full text-center text-[11px] font-semibold text-[var(--fo-ink-muted)] transition-colors hover:text-red-600"
      >
        Delete this search
      </button>
    </div>
  );
}
