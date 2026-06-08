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

export const YEARLY_TREND_SPAN = 10;

export function yearKeyFromMonthKey(monthKey: string): string | null {
  const year = monthKey.split("-")[0]?.trim();
  if (!year || !/^\d{4}$/.test(year)) return null;
  return year;
}

export function buildPastYearKeys(endMonthKey: string, span = YEARLY_TREND_SPAN): string[] {
  const endYear = Number(endMonthKey.split("-")[0]);
  if (!Number.isFinite(endYear)) return [];
  const startYear = endYear - (span - 1);
  return Array.from({ length: span }, (_, index) => String(startYear + index));
}

export function yearLabelFromKey(yearKey: string): string {
  return yearKey;
}

type BuildAnnotationDimensionTrendParams = {
  annotations: PortfolioDocumentAnnotationSummary[];
  itemMonthKeyById: Map<string, string>;
  periodKeys: string[];
  periodLabelFromKey: (periodKey: string) => string;
  valuesFromAnnotation: (annotation: PortfolioDocumentAnnotationSummary) => string[];
  topLimit?: number;
};

export function buildAnnotationDimensionTrend({
  annotations,
  itemMonthKeyById,
  periodKeys,
  periodLabelFromKey,
  valuesFromAnnotation,
  topLimit = 5,
}: BuildAnnotationDimensionTrendParams): AnnotationDimensionTrend {
  const periodSet = new Set(periodKeys);
  const globalCounts = new Map<string, number>();
  const countsByPeriod = new Map<string, Map<string, number>>();
  for (const periodKey of periodKeys) {
    countsByPeriod.set(periodKey, new Map());
  }

  for (const annotation of annotations) {
    const monthKey = itemMonthKeyById.get(annotation.sourceItemId);
    if (!monthKey) continue;
    const periodKey = yearKeyFromMonthKey(monthKey);
    if (!periodKey || !periodSet.has(periodKey)) continue;
    const periodBucket = countsByPeriod.get(periodKey);
    if (!periodBucket) continue;

    for (const raw of valuesFromAnnotation(annotation)) {
      const label = raw.trim();
      if (!label) continue;
      globalCounts.set(label, (globalCounts.get(label) ?? 0) + 1);
      periodBucket.set(label, (periodBucket.get(label) ?? 0) + 1);
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

  const series = periodKeys.map((periodKey) => {
    const bucket = countsByPeriod.get(periodKey) ?? new Map<string, number>();
    const row: AnnotationDimensionOverTimeRow = {
      monthKey: periodKey,
      monthLabel: periodLabelFromKey(periodKey),
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
  periodKeys: string[];
  periodLabelFromKey: (periodKey: string) => string;
  labelForItem: (item: PortfolioSignalItem) => string | null;
  topLimit?: number;
};

export function buildSignalLabelTrend({
  items,
  periodKeys,
  periodLabelFromKey,
  labelForItem,
  topLimit = 5,
}: BuildSignalLabelTrendParams): AnnotationDimensionTrend {
  const periodSet = new Set(periodKeys);
  const globalCounts = new Map<string, number>();
  const countsByPeriod = new Map<string, Map<string, number>>();
  for (const periodKey of periodKeys) {
    countsByPeriod.set(periodKey, new Map());
  }

  for (const item of items) {
    const label = labelForItem(item)?.trim();
    if (!label) continue;
    const periodKey = yearKeyFromMonthKey(item.monthKey);
    if (!periodKey || !periodSet.has(periodKey)) continue;
    const periodBucket = countsByPeriod.get(periodKey);
    if (!periodBucket) continue;

    globalCounts.set(label, (globalCounts.get(label) ?? 0) + 1);
    periodBucket.set(label, (periodBucket.get(label) ?? 0) + 1);
  }

  const labels = Array.from(globalCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topLimit)
    .map(([label]) => label);

  const colors: Record<string, string> = {};
  for (const [index, label] of labels.entries()) {
    colors[label] = ANNOTATION_TREND_CHART_COLORS[index] ?? "#8e9cb4";
  }

  const series = periodKeys.map((periodKey) => {
    const bucket = countsByPeriod.get(periodKey) ?? new Map<string, number>();
    const row: AnnotationDimensionOverTimeRow = {
      monthKey: periodKey,
      monthLabel: periodLabelFromKey(periodKey),
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
