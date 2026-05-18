"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { addSavedOpportunityPiMatchAction } from "@/app/actions/opportunity-pipeline-actions";
import { Button } from "@/components/ui/button";
import { PipelineSectionCard } from "@/components/opportunity-pipeline/pipeline-section-card";

export type PipelineSuggestedInvestigator = {
  id: string;
  full_name: string;
  email: string | null;
  home_department: string | null;
  division: string | null;
  research_community_id: string | null;
  why: string;
};

export function PipelineSuggestedMatches({
  opportunityId,
  suggestions,
}: {
  opportunityId: string;
  suggestions: PipelineSuggestedInvestigator[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function shortlist(id: string) {
    startTransition(async () => {
      const r = await addSavedOpportunityPiMatchAction({
        opportunityId,
        investigatorId: id,
        matchStrength: "strong",
        matchPriority: "high",
      });
      if (!r.ok) window.alert(r.error);
      else router.refresh();
    });
  }

  if (suggestions.length === 0) {
    return (
      <PipelineSectionCard
        title="Suggested matches"
        subtitle="Directory investigators in your tagged communities who are not yet on this opportunity."
      >
        <p className="text-sm text-stone-600">
          Tag at least one research community on this opportunity to surface contextual suggestions from your investigator
          directory.
        </p>
      </PipelineSectionCard>
    );
  }

  return (
    <PipelineSectionCard
      title="Suggested matches"
      subtitle="Ranked from shared research communities. One-click shortlist adds the PI with strong fit and high triage priority."
    >
      <ul className="space-y-3">
        {suggestions.map((s) => {
          const dept = [s.home_department, s.division].filter(Boolean).join(" · ") || "—";
          return (
            <li
              key={s.id}
              className="rounded-xl border border-stone-200/90 bg-stone-50/40 p-4 shadow-sm ring-1 ring-stone-950/[0.02]"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-stone-900">{s.full_name}</p>
                  <p className="mt-0.5 text-xs text-stone-600">{dept}</p>
                  <p className="mt-2 text-sm leading-relaxed text-stone-700">{s.why}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end">
                  <Button type="button" className="px-3 py-1.5 text-xs sm:min-w-[7.5rem]" disabled={pending} onClick={() => shortlist(s.id)}>
                    Shortlist
                  </Button>
                  <Link
                    href={`/investigators/${s.id}`}
                    className="inline-flex items-center justify-center rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
                  >
                    Open profile
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </PipelineSectionCard>
  );
}
