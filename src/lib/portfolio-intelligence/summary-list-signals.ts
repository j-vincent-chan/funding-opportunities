import type { PortfolioDocumentAnnotationSummary } from "@/lib/portfolio-intelligence/mock-data";
import type { PortfolioSignalItem } from "@/lib/portfolio-intelligence/mock-data";

export type PortfolioSummaryListKind =
  | "themes"
  | "methods"
  | "diseases"
  | "journals"
  | "fundingAgencies";

export type PortfolioSummaryListSignals = Record<
  PortfolioSummaryListKind,
  Record<string, PortfolioSignalItem[]>
>;

function signalTimestamp(item: PortfolioSignalItem): number {
  const raw = item.occurredAt ?? null;
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

function dedupeSignalsById(items: PortfolioSignalItem[]): PortfolioSignalItem[] {
  const seen = new Set<string>();
  const out: PortfolioSignalItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function sortSignalsNewestFirst(items: PortfolioSignalItem[]): PortfolioSignalItem[] {
  return [...items].sort((a, b) => signalTimestamp(b) - signalTimestamp(a));
}

export function buildAnnotationDimensionSignalMap(
  annotations: PortfolioDocumentAnnotationSummary[],
  itemsById: Map<string, PortfolioSignalItem>,
  dimension: "themes" | "methods" | "diseases"
): Record<string, PortfolioSignalItem[]> {
  const map: Record<string, PortfolioSignalItem[]> = {};

  for (const annotation of annotations) {
    const item = itemsById.get(annotation.sourceItemId);
    if (!item) continue;
    const values = annotation[dimension] ?? [];
    for (const raw of values) {
      const label = raw.trim();
      if (!label) continue;
      const bucket = map[label] ?? [];
      bucket.push(item);
      map[label] = bucket;
    }
  }

  for (const [label, items] of Object.entries(map)) {
    map[label] = sortSignalsNewestFirst(dedupeSignalsById(items));
  }

  return map;
}

export function buildItemLabelSignalMap(
  items: PortfolioSignalItem[],
  labelForItem: (item: PortfolioSignalItem) => string | null
): Record<string, PortfolioSignalItem[]> {
  const map: Record<string, PortfolioSignalItem[]> = {};

  for (const item of items) {
    const label = labelForItem(item)?.trim();
    if (!label) continue;
    const bucket = map[label] ?? [];
    bucket.push(item);
    map[label] = bucket;
  }

  for (const [label, bucket] of Object.entries(map)) {
    map[label] = sortSignalsNewestFirst(dedupeSignalsById(bucket));
  }

  return map;
}

export function signalsForSummaryLabel(
  listSignals: PortfolioSummaryListSignals,
  kind: PortfolioSummaryListKind,
  label: string
): PortfolioSignalItem[] {
  return listSignals[kind][label] ?? [];
}
