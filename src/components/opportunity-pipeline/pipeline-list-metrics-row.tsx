"use client";

/**
 * Parallel summary counts over the same filtered list (not stages).
 * One opportunity can contribute to several tiles at once.
 */
export function PipelineListMetricsRow({
  anchorEyebrow,
  anchorLabel,
  anchorFootnote,
  sliceTotal,
  piLinked,
  contacted,
  interested,
  assigned,
  overdue,
  secondaryDisplay = "numbers",
  summaryHint,
}: {
  anchorEyebrow: string;
  anchorLabel: string;
  /** Footer under the anchor count (e.g. untagged vs filtered cohort). */
  anchorFootnote?: string;
  sliceTotal: number;
  piLinked: number;
  contacted: number;
  interested: number;
  assigned: number;
  overdue: number;
  /** Untagged: show a dash on PI/contacted/interested/assigned/overdue tiles. */
  secondaryDisplay?: "numbers" | "na";
  /** Replaces default overlap copy under the section title when set. */
  summaryHint?: string;
}) {
  type Variant = "neutral" | "focus" | "attention" | "positive";

  const showNa = secondaryDisplay === "na";

  const secondary: { key: string; label: string; value: number; variant: Variant }[] = [
    { key: "pi", label: "PI linked", value: piLinked, variant: piLinked > 0 ? "focus" : "neutral" },
    { key: "contacted", label: "Contacted", value: contacted, variant: contacted > 0 ? "positive" : "neutral" },
    { key: "interested", label: "Interested", value: interested, variant: interested > 0 ? "positive" : "neutral" },
    {
      key: "assigned",
      label: "Assigned",
      value: assigned,
      variant:
        sliceTotal > 0 && assigned < sliceTotal ? "attention" : sliceTotal > 0 && assigned === sliceTotal ? "positive" : "neutral",
    },
    { key: "overdue", label: "Overdue", value: overdue, variant: overdue > 0 ? "attention" : "neutral" },
  ];

  function secondaryTone(v: Variant) {
    switch (v) {
      case "focus":
        return "border-[var(--fo-interaction)]/25 bg-[color-mix(in_srgb,var(--fo-select-tint)_50%,var(--fo-paper))]";
      case "attention":
        return "border-[var(--fo-warn-border)] bg-[color-mix(in_srgb,var(--fo-warn-bg)_75%,var(--fo-paper))]";
      case "positive":
        return "border-[var(--fo-success-border)] bg-[color-mix(in_srgb,var(--fo-success-bg)_70%,var(--fo-paper))]";
      default:
        return "border-[var(--fo-border)] bg-[var(--fo-paper)]";
    }
  }

  function valueTone(v: Variant) {
    switch (v) {
      case "focus":
        return "text-[var(--fo-interaction)]";
      case "attention":
        return "text-[var(--fo-warn-text)]";
      case "positive":
        return "text-[var(--fo-success-text)]";
      default:
        return "text-[var(--fo-display)]";
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="max-w-2xl">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--fo-section-label)]">Context summary</p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--fo-ink-muted)]">
          {summaryHint ??
            (showNa
              ? "Untagged notices without a research community (refine filters apply)."
              : "Same cohort across all pipeline stages. Counts overlap — one notice can appear in several metrics.")}
        </p>
      </div>

      <div
        className="flex flex-col gap-3 lg:flex-row lg:items-stretch"
        role="group"
        aria-label={`${anchorLabel}: ${sliceTotal} opportunities in the current slice; other tiles are overlapping counts on that same list.`}
      >
        <div className="flex min-w-0 shrink-0 flex-col justify-between rounded-2xl border border-[var(--fo-border-strong)] bg-[var(--fo-inset)] px-5 py-4 shadow-sm ring-1 ring-[color-mix(in_srgb,var(--fo-ink)_5%,transparent)] lg:w-[11.5rem] xl:w-[12.5rem]">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--fo-ink-muted)]">{anchorEyebrow}</p>
            <p className="mt-1.5 text-base font-semibold leading-snug text-[var(--fo-display)] [overflow-wrap:anywhere]">
              {anchorLabel}
            </p>
          </div>
          <div className="mt-4">
            <p className="text-4xl font-bold tabular-nums tracking-tight text-[var(--fo-display)]">{sliceTotal}</p>
            <p className="mt-1.5 text-[0.65rem] leading-snug text-[var(--fo-ink-muted)]">
              {anchorFootnote ?? "Matching current filters"}
            </p>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {secondary.map((c) => (
            <div
              key={c.key}
              className={`flex flex-col justify-between rounded-xl border px-3.5 py-3 shadow-sm ${secondaryTone(c.variant)}`}
            >
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[var(--fo-ink-muted)]">{c.label}</p>
              <p className={`mt-2 text-2xl font-bold tabular-nums tracking-tight ${valueTone(c.variant)}`}>
                {showNa ? "—" : c.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
