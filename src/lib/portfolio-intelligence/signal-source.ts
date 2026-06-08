import {
  isNihNewGrantByProjectNum,
  resolveNihProjectNumForItem,
} from "@/lib/community/signal-nih-funding";
import type { PortfolioSignalItem, SignalSource } from "@/lib/portfolio-intelligence/mock-data";

export type GrantTimelineSegment = "new_grants" | "continuing_grants";

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

export type SignalsOverTimeCounts = Omit<SignalSourceCounts, "grants"> &
  Record<GrantTimelineSegment, number>;

export type SignalsOverTimeSegment = keyof SignalsOverTimeCounts;

export function emptySignalsOverTimeCounts(): SignalsOverTimeCounts {
  return {
    publications: 0,
    new_grants: 0,
    continuing_grants: 0,
    clinical_trials: 0,
    news: 0,
    honors: 0,
    patents: 0,
    social: 0,
  };
}

function isContinuingGrantWithoutProjectNum(item: PortfolioSignalItem): boolean {
  const text = `${item.title} ${item.summaryText ?? ""}`.toLowerCase();
  return (
    text.includes("continuing (non-compet") ||
    text.includes("continuing non-compet") ||
    text.includes("non-competing") ||
    text.includes("continuation")
  );
}

/** NIH project numbers starting with 1 are new; all others are continuing. */
export function grantTimelineSegmentFromItem(item: PortfolioSignalItem): GrantTimelineSegment {
  const projectNum = resolveNihProjectNumForItem(item);
  if (projectNum) {
    return isNihNewGrantByProjectNum(projectNum) ? "new_grants" : "continuing_grants";
  }
  return isContinuingGrantWithoutProjectNum(item) ? "continuing_grants" : "new_grants";
}

export const signalsOverTimeStackOrder: SignalsOverTimeSegment[] = [
  "publications",
  "new_grants",
  "continuing_grants",
  "clinical_trials",
  "news",
  "honors",
  "patents",
  "social",
];

export const signalsOverTimeChartColors: Record<SignalsOverTimeSegment, string> = {
  publications: "#0e7490",
  new_grants: "#1d4ed8",
  continuing_grants: "#60a5fa",
  clinical_trials: "#059669",
  news: "#8b5cf6",
  honors: "#d97706",
  patents: "#64748b",
  social: "#ec4899",
};

export const signalsOverTimeLabels: Record<SignalsOverTimeSegment, string> = {
  publications: "Publications",
  new_grants: "New grants",
  continuing_grants: "Continuing grants",
  clinical_trials: "Clinical Trials",
  news: "News",
  honors: "Honors & Awards",
  patents: "Patents",
  social: "Social",
};

export function isSignalsOverTimeSegmentVisible(
  segment: SignalsOverTimeSegment,
  visibleSources: SignalSource[]
): boolean {
  if (segment === "new_grants" || segment === "continuing_grants") {
    return visibleSources.includes("grants");
  }
  return visibleSources.includes(segment);
}

export type SignalsOverTimeRow = SignalsOverTimeCounts & {
  monthKey: string;
  monthLabel: string;
  total: number;
};
