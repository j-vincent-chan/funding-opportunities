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

  /** Order: context anchor → PI linked → contacted → interested → assigned → overdue */
  const cells: { key: string; label: string; value: number; variant: Variant; isAnchor?: boolean }[] = [
    { key: "anchor", label: anchorLabel, value: sliceTotal, variant: "neutral", isAnchor: true },
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

  function metricShell(v: Variant, isAnchor: boolean) {
    if (isAnchor) {
      return "border border-[var(--fo-border-strong)] bg-[var(--fo-inset)] shadow-[var(--fo-shadow-metric)] ring-1 ring-[color-mix(in_srgb,var(--fo-ink)_6%,transparent)]";
    }
    const base =
      "border border-[var(--fo-border-strong)] bg-[var(--fo-paper)] shadow-[var(--fo-shadow-metric)] ring-1 ring-[color-mix(in_srgb,var(--fo-ink)_5%,transparent)]";
    switch (v) {
      case "focus":
        return `${base} border-l-[3px] border-l-[var(--fo-interaction)] bg-[color-mix(in_srgb,var(--fo-select-tint)_55%,var(--fo-paper))]`;
      case "attention":
        return `${base} border-l-[3px] border-l-[var(--fo-warn-border)] bg-[color-mix(in_srgb,var(--fo-warn-bg)_70%,var(--fo-paper))]`;
      case "positive":
        return `${base} border-l-[3px] border-l-[var(--fo-success-border)] bg-[color-mix(in_srgb,var(--fo-success-bg)_65%,var(--fo-paper))]`;
      default:
        return base;
    }
  }

  return (
    <div>
      <div className="mb-4 max-w-3xl">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--fo-section-label)]">Context summary</p>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--fo-ink-body)]">
          {summaryHint ??
            (showNa
              ? "Untagged slice: total notices without a research community tag (refine filters apply). PI workflow metrics are not shown until communities are tagged."
              : "Same community slice across Triage, Monitor, Cold, and Archived (refine filters apply). Counts overlap — one opportunity can be PI linked, contacted, assigned, and overdue at the same time.")}
        </p>
      </div>
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        role="group"
        aria-label={`${anchorLabel}: ${sliceTotal} opportunities in the current slice; other tiles are overlapping counts on that same list.`}
      >
        {cells.map((c) => (
          <div key={c.key} className={`relative overflow-hidden rounded-2xl px-4 py-4 ${metricShell(c.variant, Boolean(c.isAnchor))}`}>
            {c.isAnchor ? (
              <>
                <p className="text-[0.65rem] font-bold leading-snug tracking-wide text-[var(--fo-ink-muted)]">{anchorEyebrow}</p>
                <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-base font-bold leading-snug text-[var(--fo-display)] [overflow-wrap:anywhere] sm:text-lg">
                  {c.label}
                </p>
                <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-[var(--fo-display)]">{c.value}</p>
                <p className="mt-1.5 text-[0.65rem] font-medium leading-snug text-[var(--fo-ink-muted)]">
                  {anchorFootnote ?? "Opportunities matching filters"}
                </p>
              </>
            ) : (
              <>
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-[var(--fo-section-label)]">{c.label}</p>
                <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-[var(--fo-display)]">
                  {showNa ? "-" : c.value}
                </p>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
