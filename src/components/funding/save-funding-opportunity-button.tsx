"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toggleSavedFundingOpportunityAction } from "@/app/actions/funding-search-saves";
import { Button } from "@/components/ui/button";

function SaveStarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "h-5 w-5"}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.75}
      aria-hidden
    >
      <path
        strokeLinejoin="round"
        d="M12 2.5l2.86 5.79 6.39.93-4.62 4.5 1.09 6.36L12 17.9l-5.72 3.01 1.09-6.36-4.62-4.5 6.39-.93L12 2.5z"
      />
    </svg>
  );
}

export function SaveFundingOpportunityButton({
  opportunityId,
  initiallySaved,
  label = "Save to Match (curate under Match → Opportunity pipeline)",
}: {
  opportunityId: string;
  initiallySaved: boolean;
  /** Visible when not using compact star-only mode */
  label?: string;
}) {
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    setSaved(initiallySaved);
  }, [initiallySaved]);

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      className={`shrink-0 gap-1.5 px-2.5 py-1 text-xs font-semibold ${
        saved
          ? "border-[var(--fo-warn-border)] bg-[var(--fo-gold-soft)] text-[var(--fo-warn-text)] shadow-[var(--fo-shadow-sm)] ring-1 ring-[var(--fo-gold-ring)] hover:bg-[color-mix(in_srgb,var(--fo-gold-soft)_88%,var(--fo-warn-border)_12%)]"
          : "border-[var(--fo-border)] bg-[var(--fo-paper)] text-[var(--fo-title)] hover:bg-[var(--fo-row-hover)]"
      }`}
      aria-pressed={saved}
      title={saved ? "Remove from Match saved list" : label}
      onClick={() => {
        startTransition(async () => {
          const r = await toggleSavedFundingOpportunityAction(opportunityId);
          if (!r.ok) {
            window.alert(r.error);
            return;
          }
          setSaved(r.saved);
          router.refresh();
        });
      }}
    >
      <SaveStarIcon
        filled={saved}
        className={`h-4 w-4 ${saved ? "text-[var(--fo-gold-fill-deep)]" : "text-[var(--fo-ink-muted)]"}`}
      />
      <span className="hidden sm:inline">{saved ? "In Match" : "Save"}</span>
    </Button>
  );
}

export function SaveFundingOpportunityIconButton({
  opportunityId,
  initiallySaved,
  compact = false,
}: {
  opportunityId: string;
  initiallySaved: boolean;
  /** Matches peek panel header icon size (8×8, rounded-lg). */
  compact?: boolean;
}) {
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    setSaved(initiallySaved);
  }, [initiallySaved]);

  return (
    <button
      type="button"
      disabled={pending}
      className={`inline-flex shrink-0 items-center justify-center transition-all hover:scale-[1.06] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fo-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-50 disabled:hover:scale-100 ${
        compact ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-full"
      } ${
        saved
          ? "border-[color-mix(in_srgb,var(--fo-warn-border)_75%,var(--fo-brand)_25%)] bg-[var(--fo-gold-fill)] text-white shadow-[0_2px_8px_var(--fo-gold-shadow)] ring-2 ring-[var(--fo-gold-ring)]"
          : "border border-[var(--fo-border)] bg-[var(--fo-paper)] text-[var(--fo-ink-muted)] hover:border-[var(--fo-warn-border)] hover:bg-[var(--fo-gold-soft)] hover:text-[var(--fo-gold-fill-deep)]"
      }`}
      aria-label={saved ? "Remove from Match saved list" : "Save notice to Match"}
      aria-pressed={saved}
      title={saved ? "Saved to Match — click to remove" : "Save to Match (Opportunity pipeline)"}
      onClick={() => {
        startTransition(async () => {
          const r = await toggleSavedFundingOpportunityAction(opportunityId);
          if (!r.ok) {
            window.alert(r.error);
            return;
          }
          setSaved(r.saved);
          router.refresh();
        });
      }}
    >
      <SaveStarIcon
        filled={saved}
        className={saved ? (compact ? "h-4 w-4" : "h-[1.35rem] w-[1.35rem]") : compact ? "h-4 w-4" : "h-5 w-5"}
      />
    </button>
  );
}
