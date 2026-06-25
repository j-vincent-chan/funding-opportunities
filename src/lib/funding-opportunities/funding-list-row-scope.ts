import type { FundingListScope } from "@/lib/funding-opportunities/funding-list-url";

export type FundingListRowBucket = "open" | "forecasted" | "closed";

export type FundingListScopeRowInput = {
  status: string | null;
  close_date: string | null;
  forecasted: boolean | null;
};

export function fundingListRowScope(r: FundingListScopeRowInput, today: Date): FundingListRowBucket {
  const closedStatus = r.status === "closed" || r.status === "archived";
  const isFc = r.forecasted === true || r.status === "forecasted";

  if (closedStatus) return "closed";
  // Estimated close on forecasted notices is not a hard deadline — keep them forecasted.
  if (isFc) return "forecasted";

  let pastClose = false;
  if (r.close_date) {
    const d = new Date(r.close_date);
    pastClose = !Number.isNaN(d.getTime()) && d < today;
  }
  if (pastClose) return "closed";
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
