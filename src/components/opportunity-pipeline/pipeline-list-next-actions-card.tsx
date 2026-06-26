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

  return lines.slice(0, 5);
}

function toneStyles(tone: ActionLine["tone"]) {
  if (tone === "warn") {
    return {
      row: "border-[var(--fo-warn-border)] bg-[var(--fo-warn-bg)]",
      badge: "bg-[var(--fo-paper)] text-[var(--fo-warn-text)] ring-[var(--fo-warn-border)]",
      title: "text-[var(--fo-warn-text)]",
      detail: "text-[var(--fo-warn-text)]/85",
    };
  }
  if (tone === "good") {
    return {
      row: "border-[var(--fo-success-border)] bg-[var(--fo-success-bg)]",
      badge: "bg-[var(--fo-paper)] text-[var(--fo-success-text)] ring-[var(--fo-success-border)]",
      title: "text-[var(--fo-success-text)]",
      detail: "text-[var(--fo-success-text)]/85",
    };
  }
  return {
    row: "border-[var(--fo-border)] bg-[var(--fo-paper)]",
    badge: "bg-[var(--fo-inset)] text-[var(--fo-display)] ring-[var(--fo-border)]",
    title: "text-[var(--fo-display)]",
    detail: "text-[var(--fo-ink-muted)]",
  };
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
    <aside className="flex min-h-0 flex-col">
      <div className="mb-4">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--fo-section-label)]">Priorities</p>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-[var(--fo-display)]">Next best actions</h3>
        <p className="mt-1 text-xs leading-relaxed text-[var(--fo-ink-muted)]">
          <span className="font-medium text-[var(--fo-ink-body)]">{filtered.length}</span> in{" "}
          <span className="font-medium text-[var(--fo-ink-body)]">{sliceLabel}</span>
          {" · "}several rows can count toward multiple priorities.
        </p>
      </div>

      <ul className="flex flex-1 flex-col gap-2">
        {actions.map((a, index) => {
          const styles = toneStyles(a.tone);
          return (
            <li
              key={a.key}
              className={`rounded-xl border px-3.5 py-3 shadow-sm ${styles.row}`}
            >
              <div className="flex items-start gap-3">
                {a.count != null ? (
                  <span
                    className={`flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-lg px-1.5 text-sm font-bold tabular-nums ring-1 ${styles.badge}`}
                    aria-hidden
                  >
                    {a.count}
                  </span>
                ) : (
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--fo-inset)] text-xs font-bold text-[var(--fo-ink-muted)] ring-1 ring-[var(--fo-border)]"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-snug ${styles.title}`}>{a.title}</p>
                  {a.detail ? (
                    <p className={`mt-1 text-xs leading-relaxed ${styles.detail}`}>{a.detail}</p>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
