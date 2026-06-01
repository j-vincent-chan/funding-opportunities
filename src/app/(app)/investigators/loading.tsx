import { PageLoadingState } from "@/components/ui/page-loading-state";

export default function InvestigatorsLoading() {
  return (
    <PageLoadingState
      message="Loading investigator directory…"
      detail="Fetching profiles, tags, and cached research activity."
    />
  );
}
