import { PageLoadingState } from "@/components/ui/page-loading-state";

export default function EngagementsLoading() {
  return (
    <PageLoadingState message="Loading engagements…" detail="Fetching outreach history and strategist notes." />
  );
}
