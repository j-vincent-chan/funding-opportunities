import type { FundingListScope } from "@/lib/funding-opportunities/funding-list-url";

export type FundingListRowBucket = "open" | "forecasted" | "closed";

export type FundingListScopeRowInput = {
  status: string | null;
  close_date: string | null;
  forecasted: boolean | null;
};

export function fundingListRowScope(r: FundingListScopeRowInput, today: Date): FundingListRowBucket {
  const closedStatus = r.status === "closed" || r.status === "archived";
  let pastClose = false;
  if (r.close_date) {
    const d = new Date(r.close_date);
    pastClose = !Number.isNaN(d.getTime()) && d < today;
  }
  if (closedStatus || pastClose) return "closed";
  const isFc = r.forecasted === true || r.status === "forecasted";
  if (isFc) return "forecasted";
  return "open";
}

export function fundingListRowMatchesScope(bucket: FundingListRowBucket, scope: FundingListScope): boolean {
  if (scope === "any") return true;
  if (scope === "all") return bucket === "open" || bucket === "forecasted";
  return bucket === scope;
}

/** Posted (open) or forecasted notices only — never closed/archived digests. */
export function fundingListRowEligibleForEmailNotification(
  bucket: FundingListRowBucket,
  scope: FundingListScope
): boolean {
  return fundingListRowMatchesScope(bucket, scope) && (bucket === "open" || bucket === "forecasted");
}
