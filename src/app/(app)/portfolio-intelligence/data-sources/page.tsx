import Link from "next/link";
import { BulkRefreshCachesPanel } from "@/components/pi-community/bulk-refresh-caches-panel";
import { CommunitySignalsSyncPanel } from "@/components/pi-community/community-signals-sync-panel";
import { UcsfNewsBackfillPanel } from "@/components/pi-community/ucsf-news-backfill-panel";

export const dynamic = "force-dynamic";

export default function PortfolioIntelligenceDataSourcesPage() {
  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/portfolio-intelligence"
          className="text-xs font-medium text-[var(--fo-ink-muted)] hover:text-[var(--fo-title)]"
        >
          ← Portfolio Intelligence
        </Link>
        <h1 className="mt-2 app-page-title">Data sources</h1>
        <p className="app-page-description">
          Refresh PubMed, NIH RePORTER, and ClinicalTrials.gov caches for your investigator directory,
          sync them into community signals, and run UCSF News backfill jobs. Portfolio Intelligence
          reads these cached signals.
        </p>
      </header>

      <CommunitySignalsSyncPanel />
      <BulkRefreshCachesPanel />
      <UcsfNewsBackfillPanel />
    </div>
  );
}
