import type { PortfolioSignalItem, SignalSource } from "@/lib/portfolio-intelligence/mock-data";

export function sourceFromItem(item: PortfolioSignalItem): SignalSource {
  const category = (item.category ?? "").toLowerCase();
  const sourceType = (item.source_type ?? "").toLowerCase();
  if (category === "paper" || sourceType === "pubmed") return "publications";
  if (category === "funding" || sourceType === "reporter") return "grants";
  if (category.includes("patent") || sourceType.includes("patent")) return "patents";
  if (category === "media" || sourceType === "web") return "news";
  if (category === "award" || sourceType.includes("honor")) return "honors";
  if (sourceType.includes("trial") || category.includes("trial")) return "clinical_trials";
  if (sourceType.includes("social")) return "social";
  return "news";
}

export function groupTitleFromSource(source: SignalSource): string {
  if (source === "publications") return "Publications";
  if (source === "grants") return "Grants";
  if (source === "honors") return "Honors & Awards";
  if (source === "news") return "News";
  if (source === "clinical_trials") return "Clinical Trials";
  if (source === "patents") return "Patents";
  return "Social";
}

export const signalSourceChartColors: Record<SignalSource, string> = {
  publications: "#0e7490",
  grants: "#2563eb",
  clinical_trials: "#059669",
  news: "#8b5cf6",
  honors: "#d97706",
  patents: "#64748b",
  social: "#ec4899",
};

/** Bottom-to-top stack order for timeline charts. */
export const signalSourceStackOrder: SignalSource[] = [
  "publications",
  "grants",
  "clinical_trials",
  "news",
  "honors",
  "patents",
  "social",
];

export type SignalSourceCounts = Record<SignalSource, number>;

export function emptySignalSourceCounts(): SignalSourceCounts {
  return {
    publications: 0,
    grants: 0,
    clinical_trials: 0,
    news: 0,
    honors: 0,
    patents: 0,
    social: 0,
  };
}

export type SignalsOverTimeRow = SignalSourceCounts & {
  monthKey: string;
  monthLabel: string;
  total: number;
};
