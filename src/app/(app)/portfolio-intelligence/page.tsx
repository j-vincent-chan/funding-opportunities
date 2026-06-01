import nextDynamic from "next/dynamic";
import { PageLoadingState } from "@/components/ui/page-loading-state";
import { createClient } from "@/lib/supabase/server";
import { buildPortfolioIntelligenceData } from "@/lib/portfolio-intelligence/build-portfolio-intelligence-data";
import { mockPortfolioIntelligenceBundle } from "@/lib/portfolio-intelligence/mock-data";

export const dynamic = "force-dynamic";

const PortfolioIntelligencePage = nextDynamic(
  () =>
    import("@/components/portfolio-intelligence/portfolio-intelligence-page").then(
      (mod) => mod.PortfolioIntelligencePage
    ),
  {
    ssr: false,
    loading: () => (
      <PageLoadingState
        variant="terminal"
        message="Scanning research ecosystem…"
        detail="Aggregating signals, themes, and strategic intelligence."
      />
    ),
  }
);

export default async function PortfolioIntelligenceRoute() {
  const supabase = createClient();
  let data = mockPortfolioIntelligenceBundle;
  try {
    data = await buildPortfolioIntelligenceData(supabase);
  } catch {
    // Keep page available if live reads fail.
  }
  return <PortfolioIntelligencePage data={data} />;
}
