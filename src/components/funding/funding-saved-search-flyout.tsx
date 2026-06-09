"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  deleteSavedFundingSearchAction,
  updateSavedFundingSearchSettingsAction,
} from "@/app/actions/funding-search-saves";
import { formatDate } from "@/lib/formatting/dates";
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
        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
        checked ? "bg-[#0F6E56]" : "bg-[var(--fo-border)]",
        disabled ? "opacity-50" : "",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5",
        ].join(" ")}
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

export function FundingSavedSearchFlyout({
  search,
  onClose,
  onDeleted,
  onSaved,
}: {
  search: SavedSearchLink;
  onClose: () => void;
  onDeleted: () => void;
  onSaved: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [emailEnabled, setEmailEnabled] = useState(search.emailNotificationsEnabled);
  const [frequency, setFrequency] = useState<SavedSearchAlertFrequency>(search.alertFrequency);
  const [forecastedNotices, setForecastedNotices] = useState(search.alertForecastedNotices);

  useEffect(() => {
    setEmailEnabled(search.emailNotificationsEnabled);
    setFrequency(search.alertFrequency);
    setForecastedNotices(search.alertForecastedNotices);
  }, [search]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [onClose]);

  const lastMatchedLabel = search.lastMatchedAt
    ? formatDate(search.lastMatchedAt.slice(0, 10))
    : "—";

  return (
    <div
      ref={panelRef}
      onMouseDown={(event) => event.stopPropagation()}
      className="absolute left-0 top-[calc(100%+6px)] z-[100] w-[260px] rounded-xl border border-[var(--fo-border)] bg-white p-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
      role="dialog"
      aria-label={`Settings for ${search.name}`}
    >
      <p className="text-sm font-semibold leading-snug text-[var(--fo-title)]">{search.name}</p>
      <p className="mt-1 text-[11px] leading-snug text-[var(--fo-ink-muted)]">
        Last matched {lastMatchedLabel} · {search.newResultsRecent} new result
        {search.newResultsRecent === 1 ? "" : "s"}
      </p>

      <div className="mt-3.5 space-y-3 border-t border-[var(--fo-divider)] pt-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-[var(--fo-ink-body)]">Email alerts</span>
          <ToggleSwitch
            checked={emailEnabled}
            disabled={pending}
            onChange={setEmailEnabled}
            label="Email alerts"
          />
        </div>

        <div>
          <p className="text-[11px] font-semibold text-[var(--fo-ink-muted)]">Frequency</p>
          <div className="mt-1.5">
            <FrequencySegment value={frequency} disabled={pending || !emailEnabled} onChange={setFrequency} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-[var(--fo-ink-body)]">Also alert for</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[var(--fo-ink-muted)]">Forecasted notices</span>
          <ToggleSwitch
            checked={forecastedNotices}
            disabled={pending || !emailEnabled}
            onChange={setForecastedNotices}
            label="Forecasted notices"
          />
        </div>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await updateSavedFundingSearchSettingsAction({
              savedSearchId: search.id,
              emailNotificationsEnabled: emailEnabled,
              alertFrequency: frequency,
              alertForecastedNotices: forecastedNotices,
            });
            if (!result.ok) {
              window.alert(result.error);
              return;
            }
            onSaved();
          });
        }}
        className="mt-3.5 w-full rounded-lg bg-[var(--fo-interaction)] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--fo-interaction-hover)] disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>

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
