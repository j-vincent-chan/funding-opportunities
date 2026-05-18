"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toggleSavedFundingOpportunityAction } from "@/app/actions/funding-search-saves";
import { Button } from "@/components/ui/button";

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
      className="shrink-0 gap-1.5 border-[var(--fo-border)] bg-[var(--fo-paper)] px-2.5 py-1 text-xs font-semibold text-[var(--fo-title)] hover:bg-[var(--fo-row-hover)]"
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
      <span className="tabular-nums text-[var(--fo-interaction)]" aria-hidden>
        {saved ? "★" : "☆"}
      </span>
      <span className="hidden sm:inline">{saved ? "In Match" : "Save"}</span>
    </Button>
  );
}

export function SaveFundingOpportunityIconButton({
  opportunityId,
  initiallySaved,
}: {
  opportunityId: string;
  initiallySaved: boolean;
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
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[1.375rem] leading-none text-[var(--fo-interaction)] transition hover:scale-[1.06] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fo-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fo-inset)] disabled:opacity-50 disabled:hover:scale-100 ${
        saved ? "" : "opacity-90 hover:opacity-100"
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
      <span className="select-none" aria-hidden>
        {saved ? "★" : "☆"}
      </span>
    </button>
  );
}
