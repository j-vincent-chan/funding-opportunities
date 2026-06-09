/** Display bucket aligned with list row triage (open / forecasted / closed). */
export type FundingListStatusBucket = "open" | "forecasted" | "closed";

function statusLabel(status: FundingListStatusBucket): string {
  if (status === "forecasted") return "Forecasted";
  if (status === "closed") return "Closed";
  return "Open";
}

function statusPillClass(status: FundingListStatusBucket, size: "default" | "lg"): string {
  const base =
    size === "lg"
      ? "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3.5 py-1 text-[0.8125rem] font-bold leading-none tracking-[0.015em]"
      : "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold leading-none tracking-[0.02em]";
  const ring = "ring-1 ring-inset";
  if (status === "forecasted") {
    return `${base} bg-[color-mix(in_srgb,var(--fo-warn-bg)_72%,var(--fo-warn-border)_28%)] text-[var(--fo-warn-text)] ${ring} ring-[color-mix(in_srgb,var(--fo-warn-border)_65%,transparent)]`;
  }
  if (status === "closed") {
    return `${base} bg-[var(--fo-neutral-status-bg)] text-[var(--fo-neutral-status-text)] ${ring} ring-[color-mix(in_srgb,var(--fo-neutral-status-border)_65%,transparent)]`;
  }
  return `${base} bg-[color-mix(in_srgb,var(--fo-success-bg)_70%,var(--fo-success-border)_30%)] text-[var(--fo-success-text)] ${ring} ring-[color-mix(in_srgb,var(--fo-success-border)_70%,transparent)]`;
}

export function FundingOpportunityStatusPill({
  status,
  size = "default",
}: {
  status: FundingListStatusBucket;
  /** Larger, higher-contrast pill for dense tables. */
  size?: "default" | "lg";
}) {
  return <span className={statusPillClass(status, size)}>{statusLabel(status)}</span>;
}
