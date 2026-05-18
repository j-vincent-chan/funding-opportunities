/** Display bucket aligned with list row triage (open / forecasted / closed). */
export type FundingListStatusBucket = "open" | "forecasted" | "closed";

function statusLabel(status: FundingListStatusBucket): string {
  if (status === "forecasted") return "Forecasted";
  if (status === "closed") return "Closed";
  return "Open";
}

function statusPillClass(status: FundingListStatusBucket): string {
  const base =
    "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold leading-tight tracking-[0.02em]";
  if (status === "forecasted") {
    return `${base} bg-[#F4E7D6] text-[#8A6038] ring-1 ring-inset ring-[rgba(138,96,56,0.22)]`;
  }
  if (status === "closed") {
    return `${base} bg-[#EADDE2] text-[#7C5563] ring-1 ring-inset ring-[rgba(124,85,99,0.2)]`;
  }
  return `${base} bg-[#DDF2E7] text-[#1F6B4A] ring-1 ring-inset ring-[rgba(31,107,74,0.2)]`;
}

export function FundingOpportunityStatusPill({
  status,
}: {
  status: FundingListStatusBucket;
}) {
  return <span className={statusPillClass(status)}>{statusLabel(status)}</span>;
}
