import type { SupabaseClient } from "@supabase/supabase-js";
import {
  dedupeCommunitySourceItems,
  effectiveMonthKey,
  type CommunitySourceItemRow,
} from "@/lib/community/signal-dashboard-analytics";
import {
  fetchAllCommunitySourceItemEntityLinks,
  fetchAllCommunitySourceItems,
} from "@/lib/community/fetch-community-source-items";
import type {
  ConsultationBrief,
  FundingMechanismSlice,
  FundingOpportunityMatch,
  Investigator,
  MatchStrength,
  PortfolioDocumentAnnotationSummary,
  PortfolioIntelligenceDataBundle,
  PortfolioMetric,
  ResearchSignal,
  Theme,
  WatchedCommunity,
} from "@/lib/portfolio-intelligence/mock-data";
import {
  fetchAllDocumentAiAnnotations,
  type DocumentAiAnnotationRow,
} from "@/lib/portfolio-intelligence/fetch-document-annotations";
import {
  fetchLatestCommunitySnapshotMap,
  fetchLatestInvestigatorSnapshotMap,
} from "@/lib/portfolio-intelligence/intelligence-pipeline";

type InvestigatorRow = {
  id: string;
  full_name: string | null;
  home_department: string | null;
  division: string | null;
  research_community_id: string | null;
  raw_profile_json: unknown;
  investigator_profile_features:
    | {
        science_tags?: string[] | null;
        disease_tags?: string[] | null;
      }
    | null;
};

type FundingRow = {
  id: string;
  title: string | null;
  agency: string | null;
  opportunity_number: string | null;
  source_opportunity_id: string | null;
  close_date: string | null;
  posted_date: string | null;
  status: string | null;
};

function safeDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatShortDate(value: string | null): string {
  if (!value) return "—";
  const d = safeDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatMonthRange(now = new Date()): string {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const s = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const e = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${s} - ${e}`;
}

function summaryToText(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === "string") return raw.trim() || null;
  if (typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const candidates = [obj.summary, obj.abstract, obj.description, obj.text];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

import { resolveSignalHeadshotUrl } from "@/lib/community/signal-headshot-url";

function parseSignalEntityId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const id = (raw as { signal_entity_id?: unknown }).signal_entity_id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function extractHeadshotUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const profile = raw as Record<string, unknown>;
  return resolveSignalHeadshotUrl({
    headshot_storage_path:
      typeof profile.headshot_storage_path === "string"
        ? profile.headshot_storage_path
        : typeof profile.signal_headshot_storage_path === "string"
          ? profile.signal_headshot_storage_path
          : null,
    headshot_url:
      typeof profile.headshot_url === "string"
        ? profile.headshot_url
        : typeof profile.signal_headshot_url === "string"
          ? profile.signal_headshot_url
          : typeof profile.photo_url === "string"
            ? profile.photo_url
            : typeof profile.avatar_url === "string"
              ? profile.avatar_url
              : typeof profile.image_url === "string"
                ? profile.image_url
                : typeof profile.profile_image_url === "string"
                  ? profile.profile_image_url
                  : null,
  });
}

function itemTimestamp(item: CommunitySourceItemRow): Date | null {
  const date = safeDate(item.published_at) ?? safeDate(item.found_at) ?? safeDate(item.created_at ?? null);
  return date;
}

function percentDelta(current: number, prior: number): string {
  if (prior <= 0) return current > 0 ? "New" : "0%";
  const pct = Math.round(((current - prior) / prior) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

function buildSourceCoverage(items: CommunitySourceItemRow[]): "High" | "Medium" | "Low" {
  if (items.length === 0) return "Low";
  const withDates = items.filter((i) => !!(i.published_at || i.found_at || i.created_at)).length;
  const ratio = withDates / items.length;
  if (ratio >= 0.85) return "High";
  if (ratio >= 0.55) return "Medium";
  return "Low";
}

function activitySeriesForInvestigator(items: CommunitySourceItemRow[]): Investigator["activitySeries"] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const byMonth = new Map<string, { publications: number; grants: number; news: number; other: number }>();
  for (const key of keys) byMonth.set(key, { publications: 0, grants: 0, news: 0, other: 0 });
  for (const item of items) {
    const key = effectiveMonthKey(item);
    const bucket = byMonth.get(key);
    if (!bucket) continue;
    if (item.category === "paper" || item.source_type === "pubmed") bucket.publications += 1;
    else if (item.category === "funding" || item.source_type === "reporter") bucket.grants += 1;
    else if (item.category === "media" || item.source_type === "web") bucket.news += 1;
    else bucket.other += 1;
  }
  return keys.map((key) => {
    const [y, m] = key.split("-");
    const month = new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    const row = byMonth.get(key) ?? { publications: 0, grants: 0, news: 0, other: 0 };
    return { month, monthKey: key, ...row };
  });
}

function matchBand(score: number): MatchStrength {
  if (score >= 75) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function mechanismLabel(projectNum: string | null): string {
  const p = (projectNum ?? "").toUpperCase();
  if (/R01/.test(p)) return "R01";
  if (/R21/.test(p)) return "R21";
  if (/P01/.test(p)) return "P01 / Program";
  if (/\bU\d{2}\b/.test(p)) return "U Mechanism";
  if (/F\d{2}|K\d{2}|T\d{2}/.test(p)) return "Foundation";
  return "Other";
}

function buildFundingMix(items: CommunitySourceItemRow[]): FundingMechanismSlice[] {
  const counts = new Map<string, number>();
  const colors: Record<string, string> = {
    "R01": "#2563eb",
    "R21": "#14b8a6",
    "P01 / Program": "#7c3aed",
    "U Mechanism": "#0ea5e9",
    Foundation: "#84cc16",
    Other: "#94a3b8",
  };
  const fundingItems = items.filter((i) => i.category === "funding" || i.source_type === "reporter");
  for (const item of fundingItems) {
    const label = mechanismLabel(item.nih_project_num);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1;
  return Array.from(counts.entries())
    .map(([label, count]) => ({
      id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      label,
      percentage: Math.max(1, Math.round((count / total) * 100)),
      color: colors[label] ?? "#94a3b8",
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 6);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function sourceItemIdFromJoin(join: DocumentAiAnnotationRow["source_documents"]): string | null {
  if (!join) return null;
  if (Array.isArray(join)) return join[0]?.source_item_id ?? null;
  return join.source_item_id ?? null;
}

function scoreOpportunityForInvestigator(inv: Investigator, opp: FundingRow): number {
  const text = `${opp.title ?? ""} ${opp.agency ?? ""}`.toLowerCase();
  let score = 0;
  for (const t of inv.keyThemes) {
    const token = t.toLowerCase().split(/\s+/)[0] ?? "";
    if (token && text.includes(token)) score += 2;
  }
  score += Math.round(inv.matchStrength / 20);
  return score;
}

export async function buildPortfolioIntelligenceData(
  supabase: SupabaseClient
): Promise<PortfolioIntelligenceDataBundle> {
  const [itemsBundle, linksBundle, investigatorsRes, communitiesRes, fundingRes, annotationsBundle] =
    await Promise.all([
      fetchAllCommunitySourceItems(supabase),
      fetchAllCommunitySourceItemEntityLinks(supabase),
      supabase
        .from("investigators")
        .select(
          "id,full_name,home_department,division,research_community_id,raw_profile_json,investigator_profile_features(science_tags,disease_tags)"
        )
        .order("full_name", { ascending: true }),
      supabase.from("pipeline_communities").select("id,label").order("sort_order", { ascending: true }),
      supabase
        .from("funding_opportunities")
        .select("id,title,agency,opportunity_number,source_opportunity_id,close_date,posted_date,status")
        .order("close_date", { ascending: true, nullsFirst: false })
        .limit(120),
      fetchAllDocumentAiAnnotations(supabase),
    ]);

  const investigatorsRaw = (investigatorsRes.data ?? []) as unknown as InvestigatorRow[];
  const linksByItem = new Map<string, string[]>();
  if (!linksBundle.error) {
    for (const link of linksBundle.links) {
      const list = linksByItem.get(link.source_item_id) ?? [];
      list.push(link.signal_entity_id);
      linksByItem.set(link.source_item_id, list);
    }
  }

  const entityToInvestigator = new Map<string, string>();
  const investigatorMeta = new Map<string, InvestigatorRow>();
  for (const inv of investigatorsRaw) {
    entityToInvestigator.set(inv.id, inv.id);
    const signalEntity = parseSignalEntityId(inv.raw_profile_json);
    if (signalEntity) entityToInvestigator.set(signalEntity, inv.id);
    investigatorMeta.set(inv.id, inv);
  }

  const mappedItems: CommunitySourceItemRow[] = itemsBundle.rows.map((row) => {
    const joinIds = linksByItem.get(row.id) ?? [];
    const signalEntity = row.signal_tracked_entity_id;
    const fallbackEntity = row.prospera_investigator_id;
    const trackedIds = [
      ...new Set(
        joinIds.length > 0
          ? joinIds
          : signalEntity
            ? [signalEntity]
            : fallbackEntity
              ? [fallbackEntity]
              : []
      ),
    ];
    return {
      id: row.id,
      title: row.title,
      category: row.category,
      source_type: row.source_type,
      status: row.status,
      published_at: row.published_at,
      found_at: row.found_at,
      created_at: row.signal_created_at,
      raw_summary: row.raw_summary,
      nih_project_num: row.nih_project_num,
      source_domain: row.source_domain,
      source_url: row.source_url,
      signal_tracked_entity_id: signalEntity ?? fallbackEntity,
      tracked_entity_ids: trackedIds,
    };
  });

  const { items } = dedupeCommunitySourceItems(mappedItems);

  const itemToInvestigatorIds = new Map<string, string[]>();
  for (const item of items) {
    const entityIds = item.tracked_entity_ids ?? [];
    const ids = [
      ...new Set(
        entityIds
          .map((id) => entityToInvestigator.get(id))
          .filter((id): id is string => Boolean(id))
      ),
    ];
    itemToInvestigatorIds.set(item.id, ids);
  }

  const itemsByInvestigator = new Map<string, CommunitySourceItemRow[]>();
  for (const inv of investigatorsRaw) itemsByInvestigator.set(inv.id, []);
  for (const item of items) {
    for (const invId of itemToInvestigatorIds.get(item.id) ?? []) {
      const list = itemsByInvestigator.get(invId) ?? [];
      list.push(item);
      itemsByInvestigator.set(invId, list);
    }
  }

  const now = new Date();
  const this30Start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const prev30Start = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const thisMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const prevMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const prevMonthKey = `${prevMonthDate.getUTCFullYear()}-${String(prevMonthDate.getUTCMonth() + 1).padStart(2, "0")}`;

  const thisMonthSignals = items.filter((i) => effectiveMonthKey(i) === thisMonthKey).length;
  const prevMonthSignals = items.filter((i) => effectiveMonthKey(i) === prevMonthKey).length;
  const thisMonthFundingSignals = items.filter(
    (i) => effectiveMonthKey(i) === thisMonthKey && (i.category === "funding" || i.source_type === "reporter")
  ).length;
  const prevMonthFundingSignals = items.filter(
    (i) => effectiveMonthKey(i) === prevMonthKey && (i.category === "funding" || i.source_type === "reporter")
  ).length;

  const themeCounts = new Map<string, number>();
  const signalsByInvestigator = new Map<string, number>();
  for (const inv of investigatorsRaw) {
    const invItems = itemsByInvestigator.get(inv.id) ?? [];
    signalsByInvestigator.set(inv.id, invItems.length);
    const tags = [
      ...(inv.investigator_profile_features?.science_tags ?? []),
      ...(inv.investigator_profile_features?.disease_tags ?? []),
    ]
      .map((t) => t.trim())
      .filter(Boolean);
    const weight = Math.max(1, invItems.length);
    for (const tag of tags) {
      themeCounts.set(tag, (themeCounts.get(tag) ?? 0) + weight);
    }
  }
  const sortedThemes = Array.from(themeCounts.entries()).sort((a, b) => b[1] - a[1]);
  const topThemeEntries = sortedThemes.slice(0, 10);
  const themeTotal = topThemeEntries.reduce((acc, [, c]) => acc + c, 0) || 1;
  const themeColors = ["#1f6f8a", "#2d8ea4", "#4e7bb8", "#5e8f88", "#7a80b8", "#6f8cb7", "#8e9cb4"];
  const themeDistribution: Theme[] = topThemeEntries.slice(0, 7).map(([name, count], idx) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    percentage: Math.max(1, Math.round((count / themeTotal) * 100)),
    signalCount: count,
    color: themeColors[idx] ?? "#8e9cb4",
  }));
  const topThemeTags = topThemeEntries.map(([name]) => name);

  const signalActivitySeries: ResearchSignal[] = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(this30Start.getTime() + i * 24 * 60 * 60 * 1000);
    const dayStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const priorStart = new Date(prev30Start.getTime() + i * 24 * 60 * 60 * 1000);
    const priorEnd = new Date(priorStart.getTime() + 24 * 60 * 60 * 1000);
    const thisPeriod = items.filter((item) => {
      const ts = itemTimestamp(item);
      return ts != null && ts >= dayStart && ts < dayEnd;
    }).length;
    const priorPeriod = items.filter((item) => {
      const ts = itemTimestamp(item);
      return ts != null && ts >= priorStart && ts < priorEnd;
    }).length;
    return {
      date: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      thisPeriod,
      priorPeriod,
    };
  });

  const fundingMechanismMix = buildFundingMix(items);

  const collaborationRaw = new Map<string, number>();
  for (const inv of investigatorsRaw) collaborationRaw.set(inv.id, 0);
  for (const [, invIds] of itemToInvestigatorIds) {
    if (invIds.length < 2) continue;
    for (const id of invIds) {
      collaborationRaw.set(id, (collaborationRaw.get(id) ?? 0) + (invIds.length - 1));
    }
  }
  const maxCollab = Math.max(1, ...Array.from(collaborationRaw.values()));

  const investigatorModels: Investigator[] = investigatorsRaw.map((inv) => {
    const invItems = itemsByInvestigator.get(inv.id) ?? [];
    const recentSignals = invItems.filter((item) => {
      const ts = itemTimestamp(item);
      return ts != null && ts >= this30Start;
    }).length;
    const collaborationIndex = Math.round((collaborationRaw.get(inv.id) ?? 0) / maxCollab * 60 + 40);
    const computedMatch = Math.max(40, Math.min(98, Math.round(recentSignals * 1.8 + collaborationIndex * 0.5)));
    const keyThemes = [
      ...(inv.investigator_profile_features?.science_tags ?? []),
      ...(inv.investigator_profile_features?.disease_tags ?? []),
    ]
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 4);
    const publications = invItems.filter((item) => item.category === "paper" || item.source_type === "pubmed").length;
    const grants = invItems.filter((item) => item.category === "funding" || item.source_type === "reporter").length;
    const news = invItems.filter((item) => item.category === "media" || item.source_type === "web").length;
    const honors = invItems.filter((item) => item.category === "award").length;
    const trials = invItems.filter((item) => (item.source_type ?? "").toLowerCase().includes("trial")).length;
    const socialCount = invItems.filter((item) => (item.source_type ?? "").toLowerCase().includes("social")).length;
    const lastUpdated = invItems
      .map((item) => itemTimestamp(item))
      .filter((d): d is Date => d != null)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    return {
      id: inv.id,
      name: inv.full_name?.trim() || "Unknown investigator",
      title: inv.home_department ? `Faculty, ${inv.home_department}` : "Faculty Investigator",
      department: inv.home_department ?? inv.division ?? "—",
      affiliation: "UCSF",
      photoUrl: extractHeadshotUrl(inv.raw_profile_json),
      communityId: inv.research_community_id,
      keyThemes: keyThemes.length > 0 ? keyThemes : topThemeTags.slice(0, 3),
      recentSignals,
      collaborationIndex,
      matchStrength: computedMatch,
      matchBand: matchBand(computedMatch),
      lastUpdated: lastUpdated ? formatShortDate(lastUpdated.toISOString()) : "—",
      portfolioStats: {
        publications,
        grants,
        news,
        honors,
        trials,
        social: socialCount >= 1000 ? `${(socialCount / 1000).toFixed(1)}K` : `${socialCount}`,
      },
      activitySeries: activitySeriesForInvestigator(invItems),
    };
  });

  const fundingRows = (fundingRes.data ?? []) as FundingRow[];
  const openFunding = fundingRows.filter((row) => {
    const close = safeDate(row.close_date);
    if (!close) return true;
    return close >= now;
  });
  const opportunityMatchesByInvestigator: Record<string, FundingOpportunityMatch[]> = {};
  for (const inv of investigatorModels) {
    const matches = [...openFunding]
      .sort((a, b) => scoreOpportunityForInvestigator(inv, b) - scoreOpportunityForInvestigator(inv, a))
      .slice(0, 3)
      .map((row, idx): FundingOpportunityMatch => ({
        id: row.id,
        title: row.title ?? "(untitled opportunity)",
        agency: row.agency ?? "Unknown agency",
        opportunityId: row.opportunity_number ?? row.source_opportunity_id ?? row.id,
        loi: formatShortDate(row.close_date),
        badge: idx < 2 || inv.matchBand === "high" ? "High Match" : "Medium Match",
      }));
    if (matches.length > 0) opportunityMatchesByInvestigator[inv.id] = matches;
  }

  const consultationPrepByInvestigator: Record<string, ConsultationBrief> = {};
  const investigatorSnapshotMap = await fetchLatestInvestigatorSnapshotMap(
    supabase,
    investigatorModels.map((inv) => inv.id)
  );
  for (const inv of investigatorModels) {
    const snapshot = investigatorSnapshotMap.get(inv.id);
    consultationPrepByInvestigator[inv.id] = {
      summary:
        snapshot?.ai_brief?.trim() ||
        `Recent activity highlights ${inv.keyThemes.slice(0, 2).join(" and ")}. Collaboration index ${inv.collaborationIndex} with ${inv.recentSignals} recent signals. Prioritize opportunities with translational or investigator-initiated scope.`,
    };
  }

  const baseCommunities =
    ((communitiesRes.data ?? []) as { id: string; label: string }[]).map((c) => ({
      id: c.id,
      name: c.label,
    }));
  const communities: WatchedCommunity[] = [{ id: "all", name: "All Communities" }, ...baseCommunities];
  const communitySnapshotMap = await fetchLatestCommunitySnapshotMap(
    supabase,
    communities.map((community) => community.id).filter((id) => id !== "all")
  );
  const communityStrategyBriefByCommunityId: Record<string, string> = {};
  for (const community of communities) {
    const brief = communitySnapshotMap.get(community.id)?.ai_strategy_brief?.trim();
    if (brief) communityStrategyBriefByCommunityId[community.id] = brief;
  }

  const kpiMetrics: PortfolioMetric[] = [
    {
      id: "monitored-investigators",
      label: "Monitored Investigators",
      value: investigatorModels.length.toLocaleString(),
      delta:
        investigatorModels.filter((i) => i.recentSignals > 0).length > 0
          ? `+${investigatorModels.filter((i) => i.recentSignals > 0).length}`
          : "0",
      comparison: `vs prior 30 days`,
      tone: "positive",
    },
    {
      id: "new-signals",
      label: "New Signals This Month",
      value: thisMonthSignals.toLocaleString(),
      delta: percentDelta(thisMonthSignals, prevMonthSignals),
      comparison: "vs prior 30 days",
      tone: "positive",
    },
    {
      id: "active-funding-matches",
      label: "Active Funding Matches",
      value: openFunding.length.toLocaleString(),
      delta: percentDelta(thisMonthFundingSignals, prevMonthFundingSignals),
      comparison: "vs prior 30 days",
      tone: "positive",
    },
    {
      id: "top-emerging-themes",
      label: "Top Emerging Themes",
      value: Math.min(5, topThemeTags.length).toLocaleString(),
      delta: topThemeTags.length > 0 ? "Live" : "—",
      comparison: "from profile + signal data",
      tone: "neutral",
    },
  ];

  const documentAnnotations: PortfolioDocumentAnnotationSummary[] = [];
  for (const row of annotationsBundle.rows) {
    const sourceItemId = sourceItemIdFromJoin(row.source_documents);
    if (!sourceItemId) continue;
    documentAnnotations.push({
      sourceItemId,
      model: row.model,
      themes: stringArray(row.themes),
      methods: stringArray(row.methods),
      diseases: stringArray(row.diseases),
      translationalStage: (row.translational_stage ?? "unknown").trim() || "unknown",
    });
  }

  return {
    watchedCommunities: communities,
    timeRanges: [formatMonthRange(now), "Last 90 days", "Last 12 months"],
    sourceCoverage: buildSourceCoverage(items),
    kpiMetrics,
    themeDistribution,
    topThemeTags,
    signalActivitySeries,
    fundingMechanismMix,
    investigators: investigatorModels,
    communityItems: items.map((item) => ({
      id: item.id,
      monthKey: effectiveMonthKey(item),
      title: item.title ?? "(untitled signal)",
      summaryText: summaryToText(item.raw_summary),
      rawSummary: item.raw_summary,
      sourceDomain: item.source_domain,
      occurredAt: item.published_at ?? item.found_at ?? item.created_at ?? null,
      category: item.category,
      source_type: item.source_type,
      nih_project_num: item.nih_project_num,
      sourceUrl: item.source_url ?? null,
      investigatorIds: itemToInvestigatorIds.get(item.id) ?? [],
    })),
    documentAnnotations,
    opportunityMatchesByInvestigator,
    consultationPrepByInvestigator,
    communityStrategyBriefByCommunityId,
  };
}
