import { PageLoadingState } from "@/components/ui/page-loading-state";

export default function FundingOpportunityDetailLoading() {
  return (
    <PageLoadingState
      message="Preparing funding notice…"
      detail="Loading grant brief, eligibility, and match context."
    />
  );
}
