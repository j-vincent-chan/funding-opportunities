"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { dismissFundingOpportunityAction } from "@/app/actions/funding-search-saves";

export function DismissFundingOpportunityButton({
  opportunityId,
  onDismissed,
}: {
  opportunityId: string;
  onDismissed?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      title="Dismiss — hide this notice from your results"
      aria-label="Dismiss as not relevant"
      className="rounded-md border border-[var(--fo-border)] px-2 py-1 text-[0.7rem] font-semibold text-[var(--fo-ink-body)] transition-colors hover:border-[var(--fo-line-hover)] hover:bg-[var(--fo-row-hover)] hover:text-[var(--fo-title)] disabled:cursor-not-allowed disabled:opacity-50"
      onClick={() => {
        if (!window.confirm("Dismiss this opportunity? It will be hidden from your search results.")) {
          return;
        }
        startTransition(async () => {
          const result = await dismissFundingOpportunityAction(opportunityId);
          if (!result.ok) {
            window.alert(result.error);
            return;
          }
          onDismissed?.();
          router.refresh();
        });
      }}
    >
      {pending ? "Dismissing…" : "Dismiss"}
    </button>
  );
}
