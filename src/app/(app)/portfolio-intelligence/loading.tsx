import { PageLoadingState } from "@/components/ui/page-loading-state";

export default function PortfolioIntelligenceLoading() {
  return (
    <PageLoadingState
      variant="terminal"
      message="Scanning research ecosystem…"
      detail="Aggregating signals, themes, and strategic intelligence."
    />
  );
}
