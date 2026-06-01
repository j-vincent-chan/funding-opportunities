import type {
  PortfolioDocumentAnnotationSummary,
  PortfolioSignalItem,
} from "@/lib/portfolio-intelligence/mock-data";

export const ANNOTATION_TREND_CHART_COLORS = [
  "#0e7490",
  "#2563eb",
  "#059669",
  "#8b5cf6",
  "#d97706",
  "#64748b",
  "#ec4899",
];

export type AnnotationDimensionOverTimeRow = {
  monthKey: string;
  monthLabel: string;
  total: number;
  [label: string]: string | number;
};

export type AnnotationDimensionTrend = {
  labels: string[];
  series: AnnotationDimensionOverTimeRow[];
  colors: Record<string, string>;
};

type BuildAnnotationDimensionTrendParams = {
  annotations: PortfolioDocumentAnnotationSummary[];
  itemMonthKeyById: Map<string, string>;
  monthKeys: string[];
  monthLabelFromKey: (monthKey: string) => string;
  valuesFromAnnotation: (annotation: PortfolioDocumentAnnotationSummary) => string[];
  topLimit?: number;
};

export function buildAnnotationDimensionTrend({
  annotations,
  itemMonthKeyById,
  monthKeys,
  monthLabelFromKey,
  valuesFromAnnotation,
  topLimit = 5,
}: BuildAnnotationDimensionTrendParams): AnnotationDimensionTrend {
  const globalCounts = new Map<string, number>();
  const monthlyByLabel = new Map<string, Map<string, number>>();
  for (const monthKey of monthKeys) {
    monthlyByLabel.set(monthKey, new Map());
  }

  for (const annotation of annotations) {
    const monthKey = itemMonthKeyById.get(annotation.sourceItemId);
    if (!monthKey) continue;
    const monthBucket = monthlyByLabel.get(monthKey);
    if (!monthBucket) continue;

    for (const raw of valuesFromAnnotation(annotation)) {
      const label = raw.trim();
      if (!label) continue;
      globalCounts.set(label, (globalCounts.get(label) ?? 0) + 1);
      monthBucket.set(label, (monthBucket.get(label) ?? 0) + 1);
    }
  }

  const labels = Array.from(globalCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topLimit)
    .map(([label]) => label);

  const colors: Record<string, string> = {};
  for (const [index, label] of labels.entries()) {
    colors[label] = ANNOTATION_TREND_CHART_COLORS[index] ?? "#8e9cb4";
  }

  const series = monthKeys.map((monthKey) => {
    const bucket = monthlyByLabel.get(monthKey) ?? new Map<string, number>();
    const row: AnnotationDimensionOverTimeRow = {
      monthKey,
      monthLabel: monthLabelFromKey(monthKey),
      total: 0,
    };
    for (const label of labels) {
      const count = bucket.get(label) ?? 0;
      row[label] = count;
      row.total += count;
    }
    return row;
  });

  return { labels, series, colors };
}

type BuildSignalLabelTrendParams = {
  items: PortfolioSignalItem[];
  monthKeys: string[];
  monthLabelFromKey: (monthKey: string) => string;
  labelForItem: (item: PortfolioSignalItem) => string | null;
  topLimit?: number;
};

export function buildSignalLabelTrend({
  items,
  monthKeys,
  monthLabelFromKey,
  labelForItem,
  topLimit = 5,
}: BuildSignalLabelTrendParams): AnnotationDimensionTrend {
  const globalCounts = new Map<string, number>();
  const monthlyByLabel = new Map<string, Map<string, number>>();
  for (const monthKey of monthKeys) {
    monthlyByLabel.set(monthKey, new Map());
  }

  for (const item of items) {
    const label = labelForItem(item)?.trim();
    if (!label) continue;
    const monthBucket = monthlyByLabel.get(item.monthKey);
    if (!monthBucket) continue;

    globalCounts.set(label, (globalCounts.get(label) ?? 0) + 1);
    monthBucket.set(label, (monthBucket.get(label) ?? 0) + 1);
  }

  const labels = Array.from(globalCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topLimit)
    .map(([label]) => label);

  const colors: Record<string, string> = {};
  for (const [index, label] of labels.entries()) {
    colors[label] = ANNOTATION_TREND_CHART_COLORS[index] ?? "#8e9cb4";
  }

  const series = monthKeys.map((monthKey) => {
    const bucket = monthlyByLabel.get(monthKey) ?? new Map<string, number>();
    const row: AnnotationDimensionOverTimeRow = {
      monthKey,
      monthLabel: monthLabelFromKey(monthKey),
      total: 0,
    };
    for (const label of labels) {
      const count = bucket.get(label) ?? 0;
      row[label] = count;
      row.total += count;
    }
    return row;
  });

  return { labels, series, colors };
}
