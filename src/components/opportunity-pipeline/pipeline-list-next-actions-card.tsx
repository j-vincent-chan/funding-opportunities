"use client";

import type { PipelineBucketTab } from "@/lib/opportunity-pipeline/constants";
import { PIPELINE_BUCKET_LABEL } from "@/lib/opportunity-pipeline/constants";
import type { NormalizedPipelineItem } from "@/lib/opportunity-pipeline/serializers";

type ActionLine = { key: string; title: string; detail?: string; count?: number; tone?: "default" | "warn" | "good" };

function buildActionLines(
  bucketTab: PipelineBucketTab,
  filtered: NormalizedPipelineItem[],
  byBucketCount: number
): ActionLine[] {
  const lines: ActionLine[] = [];
  const bucketName = PIPELINE_BUCKET_LABEL[bucketTab];

  if (filtered.length === 0 && byBucketCount > 0) {
    lines.push({
      key: "filters",
      title: "Nothing in this view matches filters",
      detail: `Widen filters or change the community strip — ${byBucketCount} in ${bucketName} overall.`,
      tone: "warn",
    });
  } else if (filtered.length === 0 && byBucketCount === 0) {
    lines.push({
      key: "empty-bucket",
      title: `No opportunities in ${bucketName}`,
      detail: "Move cards from other stages or save new notices from Search.",
    });
  }

  if (bucketTab === "triage") {
    const missingComm = filtered.filter((r) => r.communities.length === 0).length;
    if (missingComm > 0) {
      lines.push({
        key: "comm",
        title: "Tag research communities",
        detail: "Routing + PI suggestions depend on community context.",
        count: missingComm,
        tone: "warn",
      });
    }
    const noPi = filtered.filter((r) => (r.saved_opportunity_pi_matches ?? []).length === 0).length;
    if (noPi > 0) {
      lines.push({
        key: "pi",
        title: "Link investigators",
        detail: "Use roster checklists or open a card to search the directory.",
        count: noPi,
        tone: "warn",
      });
    }
  }

  const unassigned = filtered.filter((r) => !r.owner_id).length;
  if (unassigned > 0) {
    lines.push({
      key: "owner",
      title: "Assign RDSG owners",
      detail: "Accountability before team review.",
      count: unassigned,
      tone: "warn",
    });
  }

  const interested = filtered.filter((r) =>
    (r.saved_opportunity_pi_matches ?? []).some((m) => m.outreach_status === "responded_interested")
  ).length;
  if (interested > 0) {
    lines.push({
      key: "int",
      title: "Follow up with interested PIs",
      detail: "Confirm fit and capture next steps on the card.",
      count: interested,
      tone: "good",
    });
  }

  const drafted = filtered.filter((r) =>
    (r.saved_opportunity_pi_matches ?? []).some((m) => m.outreach_status === "drafted")
  ).length;
  if (drafted > 0) {
    lines.push({
      key: "draft",
      title: "Clear drafted outreach",
      detail: "Send, revise, or log so Monitor stays truthful.",
      count: drafted,
    });
  }

  if (lines.length === 0) {
    lines.push({
      key: "clear",
      title: "Queue looks healthy for current filters",
      detail: `Keep advancing ${bucketName} — drill into cards for detail work.`,
      tone: "good",
    });
  }

  return lines.slice(0, 6);
}

export function PipelineListNextActionsCard({
  bucketTab,
  filtered,
  byBucketCount,
  sliceLabel,
}: {
  bucketTab: PipelineBucketTab;
  filtered: NormalizedPipelineItem[];
  byBucketCount: number;
  /** Same context as the first metrics tile (community or bucket). */
  sliceLabel: string;
}) {
  const actions = buildActionLines(bucketTab, filtered, byBucketCount);

  return (
    <aside className="relative flex flex-col overflow-hidden rounded-2xl border border-[var(--fo-border-strong)] bg-[var(--fo-paper)] shadow-[var(--fo-shadow-metric)] ring-1 ring-[color-mix(in_srgb,var(--fo-ink)_7%,transparent)]">
      <div className="border-b border-[var(--fo-divider)] bg-[var(--fo-inset)] px-5 py-4 sm:px-6 sm:py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--fo-section-label)]">Priorities</p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-[var(--fo-display)]">Next best actions</h3>
            <p className="mt-1.5 max-w-[20rem] text-xs leading-snug text-[var(--fo-ink-body)]">
              Highest-impact follow-ups for this same slice — several rows can count toward multiple priorities at once.
            </p>
          </div>
          <span className="max-w-[10.5rem] shrink-0 rounded-lg border border-[var(--fo-border-strong)] bg-[var(--fo-paper)] px-2.5 py-1.5 text-center shadow-sm">
            <span className="block line-clamp-2 text-[0.6rem] font-bold leading-tight text-[var(--fo-display)] [overflow-wrap:anywhere]">
              {sliceLabel}
            </span>
            <span className="mt-1 block text-lg font-bold tabular-nums leading-none text-[var(--fo-display)]">{filtered.length}</span>
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-4 sm:px-6 sm:pb-5">
        <ul className="space-y-3">
          {actions.map((a) => {
            const tone =
              a.tone === "warn"
                ? "border-[var(--fo-warn-border)] bg-[var(--fo-warn-bg)]"
                : a.tone === "good"
                  ? "border-[var(--fo-success-border)] bg-[var(--fo-success-bg)]"
                  : "border-[var(--fo-neutral-status-border)] bg-[var(--fo-neutral-status-bg)]";
            return (
              <li key={a.key} className={`rounded-lg border py-3 pl-3.5 pr-3.5 shadow-sm ${tone}`}>
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={`text-sm font-semibold leading-snug ${
                      a.tone === "warn"
                        ? "text-[var(--fo-warn-text)]"
                        : a.tone === "good"
                          ? "text-[var(--fo-success-text)]"
                          : "text-[var(--fo-display)]"
                    }`}
                  >
                    {a.title}
                  </p>
                  {a.count != null ? (
                    <span
                      className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-bold tabular-nums ${
                        a.tone === "warn"
                          ? "border-[var(--fo-warn-border)] bg-[var(--fo-paper)] text-[var(--fo-warn-text)] shadow-sm"
                          : a.tone === "good"
                            ? "border-[var(--fo-success-border)] bg-[var(--fo-paper)] text-[var(--fo-success-text)] shadow-sm"
                            : "border-[var(--fo-border-strong)] bg-[var(--fo-paper)] text-[var(--fo-display)] shadow-sm"
                      }`}
                    >
                      {a.count}
                    </span>
                  ) : null}
                </div>
                {a.detail ? (
                  <p
                    className={`mt-1.5 text-xs leading-relaxed ${
                      a.tone === "warn"
                        ? "text-[var(--fo-warn-text)]/90"
                        : a.tone === "good"
                          ? "text-[var(--fo-success-text)]/90"
                          : "text-[var(--fo-ink-muted)]"
                    }`}
                  >
                    {a.detail}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
