import { PageLoadingState } from "@/components/ui/page-loading-state";

export default function FundingOpportunitiesLoading() {
  return (
    <PageLoadingState
      message="Loading funding opportunities…"
      detail="Searching notices, filters, and saved items."
    />
  );
}
