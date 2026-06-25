"use client";

import { useRouter } from "next/navigation";
import { FundingOpportunityDetailView } from "@/components/funding/funding-opportunity-detail-view";
import type { FundingOpportunityPeekData } from "@/lib/funding-opportunities/funding-opportunity-peek";

export function FundingOpportunityDetailPageClient({
  data,
  loggedIn,
}: {
  data: FundingOpportunityPeekData;
  loggedIn: boolean;
}) {
  const router = useRouter();

  return (
    <FundingOpportunityDetailView
      data={data}
      loggedIn={loggedIn}
      variant="page"
      onDismissed={() => router.push("/funding-opportunities")}
    />
  );
}
