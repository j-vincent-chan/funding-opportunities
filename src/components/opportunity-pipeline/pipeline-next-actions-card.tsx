"use client";

import { getWorkflowPhase } from "@/lib/opportunity-pipeline/investigator-workflow";
import type { NormalizedPipelineItem, PipelinePiMatchRow } from "@/lib/opportunity-pipeline/serializers";

export function PipelineNextActionsCard({
  item,
  matches,
}: {
  item: NormalizedPipelineItem;
  matches: PipelinePiMatchRow[];
}) {
  const lines: string[] = [];

  const unreviewed = matches.filter((m) => getWorkflowPhase(m).id === "unreviewed").length;
  if (unreviewed > 0) {
    lines.push(`Review ${unreviewed} untriaged candidate${unreviewed === 1 ? "" : "s"}`);
  }

  const shortlisted = matches.filter((m) => m.is_primary_target && String(m.outreach_status) === "not_contacted").length;
  if (shortlisted > 0) {
    lines.push(`Prioritize outreach for ${shortlisted} shortlisted investigator${shortlisted === 1 ? "" : "s"}`);
  }

  const drafted = matches.filter((m) => m.outreach_status === "drafted").length;
  if (drafted > 0) {
    lines.push(`Send or refine ${drafted} drafted outreach${drafted === 1 ? "" : "s"}`);
  }

  const interested = matches.filter((m) => m.outreach_status === "responded_interested").length;
  if (interested > 0) {
    lines.push(`Follow up with ${interested} interested PI${interested === 1 ? "" : "s"}`);
  }

  const followUps = matches.filter((m) => m.follow_up_date).length;
  if (followUps > 0) {
    lines.push(`Confirm ${followUps} scheduled follow-up${followUps === 1 ? "" : "s"}`);
  }

  if (!item.owner_id) {
    lines.push("Assign an owner before team review");
  }

  if (item.communities.length === 0 && matches.length > 0) {
    lines.push("Tag research communities to sharpen routing and suggestions");
  }

  if (item.next_action?.trim()) {
    lines.push(`Pipeline next step: ${item.next_action.trim()}`);
  }

  if (lines.length === 0) {
    lines.push("Add investigators or advance outreach to populate this panel.");
  }

  return (
    <aside className="rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50/95 via-white to-white px-5 py-4 shadow-sm ring-1 ring-amber-900/[0.06]">
      <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-amber-900/75">Next best actions</h3>
      <ul className="mt-3 space-y-2 text-sm leading-snug text-stone-800">
        {lines.slice(0, 6).map((t) => (
          <li key={t} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600/90" aria-hidden />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
