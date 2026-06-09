"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toggleSavedFundingOpportunityAction } from "@/app/actions/funding-search-saves";
import { Button } from "@/components/ui/button";

function MatchSparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className ?? "h-4 w-4"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z" />
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
  /** Visible when not using compact icon-only mode */
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
          ? "border-transparent bg-[#534AB7] text-white shadow-sm hover:bg-[#3C3489]"
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
      <MatchSparklesIcon
        className={`h-4 w-4 ${saved ? "text-white" : "text-[#534AB7]"}`}
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
          ? "border-transparent bg-[#534AB7] text-white shadow-[0_2px_8px_rgba(83,74,183,0.28)] hover:bg-[#3C3489]"
          : "border border-[var(--fo-border)] bg-[var(--fo-paper)] text-[#534AB7] hover:border-[#534AB7] hover:bg-[#EEEDFE]"
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
      <MatchSparklesIcon
        className={
          saved
            ? compact
              ? "h-4 w-4 text-white"
              : "h-[1.35rem] w-[1.35rem] text-white"
            : compact
              ? "h-4 w-4 text-[#534AB7]"
              : "h-5 w-5 text-[#534AB7]"
        }
      />
    </button>
  );
}
