import { nihFundingDashboardBucket } from "@/lib/community/signal-nih-funding";

export type DashboardRange = "ytd" | "1y" | "2y" | "5y" | "max";

/** Roster entry for Community investigator filter (Prospera id + linked Signal entity ids). */
export type CommunityInvestigatorOption = {
  id: string;
  name: string;
  entityIds: string[];
};

export type CommunitySourceItemRow = {
  id: string;
  title: string | null;
  category: string | null;
  source_type: string | null;
  status: string | null;
  published_at: string | null;
  found_at: string | null;
  created_at?: string | null;
  raw_summary: string | null;
  nih_project_num: string | null;
  source_domain: string | null;
  source_url?: string | null;
  signal_tracked_entity_id?: string | null;
  tracked_entity_ids?: string[];
};

export type MonthlyKpiPoint = {
  month: string;
  shortLabel: string;
  total: number;
  paper: number;
  award: number;
  media: number;
  newFunding: number;
  activeGrants: number;
  other: number;
  approved: number;
  pubmed: number;
  web: number;
  manual: number;
  lab_website: number;
  reporter: number;
};

export type MonthlyKpiTotals = Omit<MonthlyKpiPoint, "month" | "shortLabel">;

const EMPTY_TOTALS = (): MonthlyKpiTotals => ({
  total: 0,
  paper: 0,
  award: 0,
  media: 0,
  newFunding: 0,
  activeGrants: 0,
  other: 0,
  approved: 0,
  pubmed: 0,
  web: 0,
  manual: 0,
  lab_website: 0,
  reporter: 0,
});

function monthKeyFromValue(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const text = String(value).trim();
  if (!text) return "";
  const m = text.match(/^(\d{4}-\d{2})/);
  if (m?.[1]) return m[1];
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function effectiveMonthKey(item: CommunitySourceItemRow): string {
  return (
    monthKeyFromValue(item.published_at) ||
    monthKeyFromValue(item.found_at) ||
    monthKeyFromValue(item.created_at) ||
    monthKeyFromValue(new Date().toISOString())
  );
}

/** Stable key for collapsing duplicate imports (same paper/grant, different row ids). */
export function communityItemDedupeKey(item: CommunitySourceItemRow): string {
  const url = (item.source_url ?? "").trim().toLowerCase();
  if (url.length > 0) return `url:${url}`;

  const title = (item.title ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const month = effectiveMonthKey(item);
  const entity = (
    item.tracked_entity_ids?.[0] ??
    item.signal_tracked_entity_id ??
    ""
  )
    .toString()
    .toLowerCase();
  const project = (item.nih_project_num ?? "").trim().toLowerCase();
  if (project) return `nih:${project}|${month}|${entity}`;

  return `t:${title}|m:${month}|e:${entity}`;
}

export function dedupeCommunitySourceItems(items: CommunitySourceItemRow[]): {
  items: CommunitySourceItemRow[];
  removedDuplicateIds: number;
} {
  const byId = new Map<string, CommunitySourceItemRow>();
  for (const item of items) {
    byId.set(item.id, item);
  }

  const byContent = new Map<string, CommunitySourceItemRow>();
  for (const item of byId.values()) {
    const key = communityItemDedupeKey(item);
    if (!byContent.has(key)) byContent.set(key, item);
  }

  const deduped = Array.from(byContent.values());
  return {
    items: deduped,
    removedDuplicateIds: items.length - deduped.length,
  };
}

export function rangeStartMonth(range: DashboardRange, now = new Date()): string | null {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const current = `${year}-${pad(month)}`;
  if (range === "max") return null;
  if (range === "ytd") return `${year}-01`;
  const start = new Date(Date.UTC(year, month - 1, 1));
  const offset = range === "1y" ? 11 : range === "2y" ? 23 : 47;
  start.setUTCMonth(start.getUTCMonth() - offset);
  const key = `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}`;
  return key <= current ? key : current;
}

export function formatMonthShortLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  const year = Number(y);
  const mon = Number(m);
  if (!Number.isFinite(year) || !Number.isFinite(mon)) return monthKey;
  const d = new Date(Date.UTC(year, mon - 1, 1));
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export function formatDashboardSnapshotLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function bumpSourceType(totals: MonthlyKpiTotals, sourceType: string | null | undefined) {
  switch (sourceType) {
    case "pubmed":
      totals.pubmed += 1;
      break;
    case "web":
      totals.web += 1;
      break;
    case "manual":
      totals.manual += 1;
      break;
    case "lab_website":
      totals.lab_website += 1;
      break;
    case "reporter":
      totals.reporter += 1;
      break;
    default:
      break;
  }
}

function bumpCategory(totals: MonthlyKpiTotals, item: CommunitySourceItemRow) {
  const category = item.category ?? "other";
  if (category === "paper") {
    totals.paper += 1;
    return;
  }
  if (category === "award") {
    totals.award += 1;
    return;
  }
  if (category === "media") {
    totals.media += 1;
    return;
  }
  if (category === "funding") {
    const bucket = nihFundingDashboardBucket(item);
    if (bucket === "active_grant") totals.activeGrants += 1;
    else totals.newFunding += 1;
    return;
  }
  totals.other += 1;
}

function bumpItem(totals: MonthlyKpiTotals, item: CommunitySourceItemRow) {
  totals.total += 1;
  bumpCategory(totals, item);
  bumpSourceType(totals, item.source_type);
  if (item.status === "approved") totals.approved += 1;
}

export function buildMonthlySeries(items: CommunitySourceItemRow[]): MonthlyKpiPoint[] {
  const byMonth = new Map<string, MonthlyKpiTotals>();
  for (const item of items) {
    const month = effectiveMonthKey(item);
    if (!month) continue;
    const bucket = byMonth.get(month) ?? EMPTY_TOTALS();
    bumpItem(bucket, item);
    byMonth.set(month, bucket);
  }
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, totals]) => ({
      month,
      shortLabel: formatMonthShortLabel(month),
      ...totals,
    }));
}

export function filterMonthlyByRange(
  monthly: MonthlyKpiPoint[],
  range: DashboardRange,
  now = new Date()
): MonthlyKpiPoint[] {
  const start = rangeStartMonth(range, now);
  if (!start) return monthly;
  return monthly.filter((row) => row.month >= start);
}

export function sumMonthlyKpis(monthly: MonthlyKpiPoint[]): MonthlyKpiTotals {
  return monthly.reduce(
    (acc, row) => ({
      total: acc.total + row.total,
      paper: acc.paper + row.paper,
      award: acc.award + row.award,
      media: acc.media + row.media,
      newFunding: acc.newFunding + row.newFunding,
      activeGrants: acc.activeGrants + row.activeGrants,
      other: acc.other + row.other,
      approved: acc.approved + row.approved,
      pubmed: acc.pubmed + row.pubmed,
      web: acc.web + row.web,
      manual: acc.manual + row.manual,
      lab_website: acc.lab_website + row.lab_website,
      reporter: acc.reporter + row.reporter,
    }),
    EMPTY_TOTALS()
  );
}

export function cumulativeTotalSeries(monthly: MonthlyKpiPoint[]): { month: string; shortLabel: string; cumulative: number }[] {
  let cumulative = 0;
  return monthly.map((row) => {
    cumulative += row.total;
    return { month: row.month, shortLabel: row.shortLabel, cumulative };
  });
}

export function topEntitiesInRange(
  items: CommunitySourceItemRow[],
  entityNameById: Record<string, string>,
  range: DashboardRange,
  limit = 20,
  now = new Date()
): { id: string; name: string; count: number }[] {
  const start = rangeStartMonth(range, now);
  const counts = new Map<string, number>();
  for (const item of items) {
    const month = effectiveMonthKey(item);
    if (start && month < start) continue;
    const entityIds =
      item.tracked_entity_ids && item.tracked_entity_ids.length > 0
        ? item.tracked_entity_ids
        : item.signal_tracked_entity_id
          ? [item.signal_tracked_entity_id]
          : [];
    for (const id of entityIds) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([id, count]) => ({ id, name: entityNameById[id] ?? "Unknown", count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function pubmedJournalLabel(item: CommunitySourceItemRow): string | null {
  if (item.source_type !== "pubmed") return null;
  const first = (item.raw_summary ?? "").split(" · ")[0]?.trim();
  return first || "PubMed (unknown journal)";
}

export function grantAgencyLabel(item: CommunitySourceItemRow): string | null {
  if (item.category !== "funding" || item.source_type !== "reporter") return null;
  const parts = (item.raw_summary ?? "")
    .split(" · ")
    .map((p) => p.trim())
    .filter(Boolean);
  const trimmed = parts.length > 0 && /^award class:/i.test(parts[0]!) ? parts.slice(1) : parts;
  const fromSummary = trimmed[0] ?? null;
  if (fromSummary) return fromSummary;
  if (item.source_domain === "reporter.nih.gov") return "NIH (unknown institute)";
  return item.source_domain?.replace(/^www\./, "") ?? "Unknown agency";
}

export function itemsInRange(
  items: CommunitySourceItemRow[],
  range: DashboardRange,
  now = new Date()
): CommunitySourceItemRow[] {
  const start = rangeStartMonth(range, now);
  if (!start) return items;
  return items.filter((item) => effectiveMonthKey(item) >= start);
}

export function communityItemEntityIds(item: CommunitySourceItemRow): string[] {
  const ids =
    item.tracked_entity_ids && item.tracked_entity_ids.length > 0
      ? item.tracked_entity_ids
      : item.signal_tracked_entity_id
        ? [item.signal_tracked_entity_id]
        : [];
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

/** When `selectedInvestigatorIds` is empty, returns all items (no filter). */
export function filterCommunityItemsByInvestigators(
  items: CommunitySourceItemRow[],
  investigators: CommunityInvestigatorOption[],
  selectedInvestigatorIds: readonly string[] | null | undefined
): CommunitySourceItemRow[] {
  if (!selectedInvestigatorIds?.length) return items;

  const selected = new Set(selectedInvestigatorIds);
  const entityIds = new Set<string>();
  for (const inv of investigators) {
    if (!selected.has(inv.id)) continue;
    for (const eid of inv.entityIds) entityIds.add(eid);
  }
  if (entityIds.size === 0) return [];

  return items.filter((item) =>
    communityItemEntityIds(item).some((id) => entityIds.has(id))
  );
}

export function communityItemsMonthSpan(
  items: CommunitySourceItemRow[]
): { earliest: string; latest: string } | null {
  let earliest: string | null = null;
  let latest: string | null = null;
  for (const item of items) {
    const month = effectiveMonthKey(item);
    if (!month) continue;
    if (!earliest || month < earliest) earliest = month;
    if (!latest || month > latest) latest = month;
  }
  if (!earliest || !latest) return null;
  return { earliest, latest };
}

export function formatMonthSpanLabel(span: { earliest: string; latest: string }): string {
  const a = formatMonthShortLabel(span.earliest);
  const b = formatMonthShortLabel(span.latest);
  return span.earliest === span.latest ? a : `${a} – ${b}`;
}

export function truncateLabel(text: string, max = 42): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 1))}…`;
}
