"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin-service";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  clearPortfolioAiFailure,
  fetchPortfolioAiFailureMap,
  recordPortfolioAiFailure,
  replaceDocumentChunks,
  upsertCommunityIntelligenceSnapshot,
  upsertInvestigatorPortfolioSnapshot,
  upsertSourceDocumentsFromItems,
} from "@/lib/portfolio-intelligence/intelligence-pipeline";
import type { SourceDocumentRow } from "@/lib/portfolio-intelligence/intelligence-types";
import { buildPortfolioIntelligenceData } from "@/lib/portfolio-intelligence/build-portfolio-intelligence-data";
import { synthesizeCommunityAiBrief, synthesizeInvestigatorAiBrief } from "@/lib/ai/portfolio-snapshot-synthesis";
import { enrichTextFromSourceUrl } from "@/lib/ai/source-document-url-enrichment";
import {
  MAX_ANNOTATE_DOCUMENTS,
  resolveAnnotationConcurrency,
  runPortfolioDocumentAnnotationBatch,
} from "@/lib/portfolio-intelligence/annotate-source-documents";

type CommunitySourceItemSeedRow = {
  id: string;
  title: string | null;
  category: string | null;
  source_type: string | null;
  source_url: string | null;
  published_at: string | null;
  raw_summary: unknown;
  raw_text: string | null;
};

type SourceDocumentEnrichmentRow = Pick<
  SourceDocumentRow,
  "id" | "title" | "source_url" | "abstract_text" | "full_text" | "raw_payload"
>;

const SUPABASE_PAGE_SIZE = 1000;
const MAX_SEED_SOURCE_ITEMS = 100_000;
const MAX_ENRICH_SOURCE_URLS = 100_000;

async function fetchPagedRows<T>(opts: {
  limit: number;
  fetchPage: (from: number, to: number) => Promise<{
    data: T[] | null;
    error: { message: string } | null;
  }>;
}): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  let from = 0;

  while (rows.length < opts.limit) {
    const remaining = opts.limit - rows.length;
    const pageSize = Math.min(SUPABASE_PAGE_SIZE, remaining);
    const to = from + pageSize - 1;
    const { data, error } = await opts.fetchPage(from, to);
    if (error) return { rows, error: error.message };

    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return { rows, error: null };
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

type AnnotationJoinRow = {
  summary: string | null;
  themes: unknown;
  methods: unknown;
  diseases: unknown;
  translational_stage: string | null;
  funding_relevance_tags: unknown;
  evidence_quotes: unknown;
  confidence: number | null;
  source_documents: { source_item_id: string } | Array<{ source_item_id: string }> | null;
};

type ParsedAnnotation = {
  sourceItemId: string;
  summary: string;
  themes: string[];
  methods: string[];
  diseases: string[];
  translationalStage: string;
  fundingTags: string[];
  evidenceQuotes: string[];
  confidence: number;
};

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function sourceBucket(
  item: { category: string | null; source_type: string | null }
): "publications" | "grants" | "news" | "honors" | "trials" | "social" | "other" {
  const category = (item.category ?? "").toLowerCase();
  const sourceType = (item.source_type ?? "").toLowerCase();
  if (category === "paper" || sourceType === "pubmed") return "publications";
  if (category === "funding" || sourceType === "reporter") return "grants";
  if (category === "media" || sourceType === "web") return "news";
  if (category === "award" || sourceType.includes("honor")) return "honors";
  if (sourceType.includes("trial") || category.includes("trial")) return "trials";
  if (sourceType.includes("social")) return "social";
  return "other";
}

function topCounts(entries: string[], take = 10): Array<{ label: string; count: number; pct: number }> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const key = entry.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, take);
  const total = sorted.reduce((acc, [, count]) => acc + count, 0) || 1;
  return sorted.map(([label, count]) => ({
    label,
    count,
    pct: Math.round((count / total) * 100),
  }));
}

function firstSourceItemId(row: AnnotationJoinRow): string | null {
  if (!row.source_documents) return null;
  if (Array.isArray(row.source_documents)) return row.source_documents[0]?.source_item_id ?? null;
  return row.source_documents.source_item_id ?? null;
}

function parseAnnotationRows(rows: AnnotationJoinRow[]): ParsedAnnotation[] {
  const parsed: ParsedAnnotation[] = [];
  for (const row of rows) {
    const sourceItemId = firstSourceItemId(row);
    if (!sourceItemId) continue;
    parsed.push({
      sourceItemId,
      summary: row.summary?.trim() ?? "",
      themes: parseStringArray(row.themes),
      methods: parseStringArray(row.methods),
      diseases: parseStringArray(row.diseases),
      translationalStage: row.translational_stage ?? "unknown",
      fundingTags: parseStringArray(row.funding_relevance_tags),
      evidenceQuotes: parseStringArray(row.evidence_quotes),
      confidence: typeof row.confidence === "number" ? row.confidence : 0.5,
    });
  }
  return parsed;
}

function shouldSkipForRetryControl(
  row:
    | {
        attempt_count: number;
        status: "open" | "resolved" | "exhausted";
        next_retry_at: string | null;
      }
    | undefined,
  nowIso: string
): boolean {
  if (!row || row.status === "resolved") return false;
  if (row.status === "exhausted") return true;
  if (!row.next_retry_at) return false;
  return row.next_retry_at > nowIso;
}

function investigatorSnapshotDedupeKey(
  model: string,
  investigatorId: string,
  windowStart: string,
  windowEnd: string
): string {
  return `snapshot_investigator:${model}:${investigatorId}:${windowStart}:${windowEnd}`;
}

function communitySnapshotDedupeKey(
  model: string,
  communityId: string,
  windowStart: string,
  windowEnd: string
): string {
  return `snapshot_community:${model}:${communityId}:${windowStart}:${windowEnd}`;
}

/**
 * Seed source_documents + document_chunks from community_source_items.
 * This is the first-step backfill before LLM annotation/snapshot jobs.
 */
export async function seedPortfolioSourceDocuments(limit = 600) {
  const sessionClient = createClient();
  const admin = await requireAdmin(sessionClient);
  if (!admin.ok) return { ok: false as const, error: admin.error };
  const supabase = createServiceRoleClient() ?? sessionClient;

  const capped = Math.max(1, Math.min(MAX_SEED_SOURCE_ITEMS, limit));
  const paged = await fetchPagedRows<CommunitySourceItemSeedRow>({
    limit: capped,
    fetchPage: async (from, to) => {
      const res = await supabase
        .from("community_source_items")
        .select("id,title,category,source_type,source_url,published_at,raw_summary,raw_text")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true })
        .range(from, to);
      return {
        data: (res.data ?? []) as CommunitySourceItemSeedRow[],
        error: res.error ? { message: res.error.message } : null,
      };
    },
  });
  if (paged.error) return { ok: false as const, error: paged.error };

  const rows = paged.rows;
  const textBySourceItemId = new Map(
    rows.map((row) => [
      row.id,
      (row.raw_text ?? summaryToText(row.raw_summary) ?? "").trim(),
    ])
  );

  try {
    const upserted = await upsertSourceDocumentsFromItems(
      supabase,
      rows.map((row) => ({
        sourceItemId: row.id,
        title: row.title ?? "(untitled signal)",
        summaryText: summaryToText(row.raw_summary),
        fullText: row.raw_text,
        sourceUrl: row.source_url,
        publishedAt: row.published_at,
        category: row.category,
        sourceType: row.source_type,
        rawPayload: {
          category: row.category,
          source_type: row.source_type,
        },
      }))
    );

    let chunksWritten = 0;
    let chunkErrors = 0;
    const chunkErrorSamples: string[] = [];
    const CHUNK_CONCURRENCY = 4;
    for (let i = 0; i < upserted.length; i += CHUNK_CONCURRENCY) {
      const slice = upserted.slice(i, i + CHUNK_CONCURRENCY);
      const counts = await Promise.all(
        slice.map(async (doc) => {
          const text =
            textBySourceItemId.get(doc.source_item_id) ??
            (doc.full_text ?? doc.abstract_text ?? "").trim();
          if (!text) return 0;
          try {
            return await replaceDocumentChunks(supabase, doc.id, text);
          } catch (e) {
            chunkErrors += 1;
            if (chunkErrorSamples.length < 5) {
              const msg = e instanceof Error ? e.message : String(e);
              chunkErrorSamples.push(`${doc.source_item_id.slice(0, 8)}… ${msg}`);
            }
            return 0;
          }
        })
      );
      chunksWritten += counts.reduce((sum, n) => sum + n, 0);
    }

    revalidatePath("/portfolio-intelligence");
    return {
      ok: true as const,
      sourceItemsRead: rows.length,
      documentsUpserted: upserted.length,
      chunksWritten,
      chunkErrors,
      chunkErrorSamples,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Seed failed";
    return { ok: false as const, error: message };
  }
}

/**
 * Phase 2: run per-document structured extraction into document_ai_annotations.
 * Includes strict schema validation and per-document error capture.
 */
export async function annotatePortfolioSourceDocuments(params?: {
  limit?: number;
  model?: string;
  skipAlreadyAnnotated?: boolean;
  maxAttempts?: number;
  concurrency?: number;
}) {
  const sessionClient = createClient();
  const admin = await requireAdmin(sessionClient);
  if (!admin.ok) return { ok: false as const, error: admin.error };
  const supabase = createServiceRoleClient() ?? sessionClient;

  try {
    const result = await runPortfolioDocumentAnnotationBatch(supabase, {
      limit: Math.max(1, Math.min(MAX_ANNOTATE_DOCUMENTS, params?.limit ?? 200)),
      offset: 0,
      model: params?.model,
      skipAlreadyAnnotated: params?.skipAlreadyAnnotated,
      maxAttempts: params?.maxAttempts,
      concurrency: resolveAnnotationConcurrency(params?.concurrency),
    });
    revalidatePath("/portfolio-intelligence");
    return { ok: true as const, ...result };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false as const, error: message };
  }
}

/**
 * Phase 1b: fetch text from `source_url` and enrich source_documents with abstract/full text.
 * This is best-effort and only updates rows missing text unless `overwrite` is enabled.
 */
export async function enrichPortfolioSourceDocumentsFromUrls(params?: {
  limit?: number;
  overwrite?: boolean;
}) {
  const supabase = createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return { ok: false as const, error: admin.error };

  const limit = Math.max(1, Math.min(MAX_ENRICH_SOURCE_URLS, params?.limit ?? 200));
  const overwrite = params?.overwrite ?? false;
  const paged = await fetchPagedRows<SourceDocumentEnrichmentRow>({
    limit,
    fetchPage: async (from, to) => {
      const res = await supabase
        .from("source_documents")
        .select("id,title,source_url,abstract_text,full_text,raw_payload")
        .not("source_url", "is", null)
        .order("ingested_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
      return {
        data: (res.data ?? []) as SourceDocumentEnrichmentRow[],
        error: res.error ? { message: res.error.message } : null,
      };
    },
  });
  if (paged.error) return { ok: false as const, error: paged.error };

  const rows = paged.rows;
  let processed = 0;
  let enriched = 0;
  let skippedExisting = 0;
  let skippedNoUrl = 0;
  let skippedNoExtractableText = 0;
  const failures: Array<{ documentId: string; title: string; error: string }> = [];

  for (const row of rows) {
    processed += 1;
    const sourceUrl = row.source_url?.trim();
    if (!sourceUrl) {
      skippedNoUrl += 1;
      continue;
    }
    const hasExistingText =
      (row.full_text?.trim().length ?? 0) >= 600 || (row.abstract_text?.trim().length ?? 0) >= 120;
    if (!overwrite && hasExistingText) {
      skippedExisting += 1;
      continue;
    }

    const fetched = await enrichTextFromSourceUrl(sourceUrl);
    if (!fetched.ok) {
      if (fetched.error.includes("No extractable")) {
        skippedNoExtractableText += 1;
      } else {
        failures.push({
          documentId: row.id,
          title: row.title,
          error: fetched.error,
        });
      }
      continue;
    }

    const nextPayload = {
      ...((row.raw_payload ?? {}) as Record<string, unknown>),
      enrichment: {
        source: "source_url",
        method: fetched.extractionMethod,
        last_enriched_at: new Date().toISOString(),
        final_url: fetched.finalUrl,
        content_type: fetched.contentType,
      },
    };
    const update = {
      abstract_text:
        fetched.abstractText?.trim() ||
        row.abstract_text ||
        null,
      full_text:
        fetched.fullText?.trim() ||
        row.full_text ||
        null,
      raw_payload: nextPayload,
    };
    const { error: updateErr } = await supabase.from("source_documents").update(update).eq("id", row.id);
    if (updateErr) {
      failures.push({
        documentId: row.id,
        title: row.title,
        error: updateErr.message,
      });
      continue;
    }
    enriched += 1;
  }

  revalidatePath("/portfolio-intelligence");
  return {
    ok: true as const,
    processed,
    enriched,
    skippedExisting,
    skippedNoUrl,
    skippedNoExtractableText,
    failed: failures.length,
    failures: failures.slice(0, 50),
  };
}

/**
 * Phase 3: synthesize investigator/community snapshots from document annotations.
 */
export async function synthesizePortfolioIntelligenceSnapshots(params?: {
  months?: number;
  model?: string;
  maxInvestigators?: number;
  maxCommunities?: number;
  maxAttempts?: number;
}) {
  const supabase = createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return { ok: false as const, error: admin.error };

  const months = Math.max(1, Math.min(20000, params?.months ?? 12));
  const model = (params?.model ?? "gpt-4o-mini").trim();
  const maxInvestigators = Math.max(1, Math.min(20000, params?.maxInvestigators ?? 150));
  const maxCommunities = Math.max(1, Math.min(20000, params?.maxCommunities ?? 20));
  const maxAttempts = Math.max(1, Math.min(10, params?.maxAttempts ?? 3));

  const windowEndDate = new Date();
  const windowStartDate = new Date(
    Date.UTC(windowEndDate.getUTCFullYear(), windowEndDate.getUTCMonth() - (months - 1), 1)
  );
  const windowStart = windowStartDate.toISOString().slice(0, 10);
  const windowEnd = windowEndDate.toISOString().slice(0, 10);
  const startMonthKey = `${windowStartDate.getUTCFullYear()}-${String(windowStartDate.getUTCMonth() + 1).padStart(2, "0")}`;

  const [bundle, annotationsRaw] = await Promise.all([
    buildPortfolioIntelligenceData(supabase),
    supabase
      .from("document_ai_annotations")
      .select(
        "summary,themes,methods,diseases,translational_stage,funding_relevance_tags,evidence_quotes,confidence,source_documents!inner(source_item_id),model"
      )
      .eq("model", model),
  ]);

  if (annotationsRaw.error) {
    return { ok: false as const, error: annotationsRaw.error.message };
  }

  const parsedAnnotations = parseAnnotationRows((annotationsRaw.data ?? []) as AnnotationJoinRow[]);
  const annotationsBySourceItem = new Map<string, ParsedAnnotation[]>();
  for (const annotation of parsedAnnotations) {
    const list = annotationsBySourceItem.get(annotation.sourceItemId) ?? [];
    list.push(annotation);
    annotationsBySourceItem.set(annotation.sourceItemId, list);
  }

  const windowItems = bundle.communityItems.filter((item) => item.monthKey >= startMonthKey);

  let investigatorProcessed = 0;
  let investigatorSucceeded = 0;
  let investigatorFailed = 0;
  let investigatorRetryDeferred = 0;
  let investigatorRetryExhausted = 0;
  let communityProcessed = 0;
  let communitySucceeded = 0;
  let communityFailed = 0;
  let communityRetryDeferred = 0;
  let communityRetryExhausted = 0;
  const failures: string[] = [];
  const nowIso = new Date().toISOString();

  const investigatorRows = bundle.investigators.slice(0, maxInvestigators);
  const investigatorFailureMap = await fetchPortfolioAiFailureMap(
    supabase,
    investigatorRows.map((investigator) =>
      investigatorSnapshotDedupeKey(model, investigator.id, windowStart, windowEnd)
    )
  );
  for (const investigator of investigatorRows) {
    investigatorProcessed += 1;
    const dedupeKey = investigatorSnapshotDedupeKey(
      model,
      investigator.id,
      windowStart,
      windowEnd
    );
    const retryState = investigatorFailureMap.get(dedupeKey);
    if (shouldSkipForRetryControl(retryState, nowIso)) {
      if (retryState?.status === "exhausted") investigatorRetryExhausted += 1;
      else investigatorRetryDeferred += 1;
      continue;
    }
    try {
      const items = windowItems.filter((item) => item.investigatorIds.includes(investigator.id));
      if (items.length === 0) continue;
      const sourceItemIds = items.map((item) => item.id);
      const annotations = sourceItemIds.flatMap((id) => annotationsBySourceItem.get(id) ?? []);
      const themes = topCounts(annotations.flatMap((row) => row.themes), 12);
      const methods = topCounts(annotations.flatMap((row) => row.methods), 8);
      const diseases = topCounts(annotations.flatMap((row) => row.diseases), 8);
      const stageCounts = topCounts(annotations.map((row) => row.translationalStage), 6);
      const translationalStage = stageCounts[0]?.label ?? "unknown";

      const monthlyCounts = new Map<string, number>();
      for (const item of items) {
        monthlyCounts.set(item.monthKey, (monthlyCounts.get(item.monthKey) ?? 0) + 1);
      }
      const trajectoryMetrics = {
        monthly_signal_counts: Array.from(monthlyCounts.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, count]) => ({ month, count })),
        avg_annotation_confidence:
          annotations.length > 0
            ? Number(
                (
                  annotations.reduce((acc, row) => acc + row.confidence, 0) / Math.max(1, annotations.length)
                ).toFixed(3)
              )
            : null,
      };

      const signalCounts = {
        publications: items.filter((item) => sourceBucket(item) === "publications").length,
        grants: items.filter((item) => sourceBucket(item) === "grants").length,
        news: items.filter((item) => sourceBucket(item) === "news").length,
        honors: items.filter((item) => sourceBucket(item) === "honors").length,
        trials: items.filter((item) => sourceBucket(item) === "trials").length,
        social: items.filter((item) => sourceBucket(item) === "social").length,
      };

      const aiBrief = await synthesizeInvestigatorAiBrief(
        {
          investigatorName: investigator.name,
          topThemes: themes.map((row) => row.label).slice(0, 6),
          topMethods: methods.map((row) => row.label).slice(0, 6),
          topDiseases: diseases.map((row) => row.label).slice(0, 6),
          translationalStage,
          signalCounts,
          annotationSummaries: annotations
            .map((row) => row.summary)
            .filter(Boolean)
            .slice(0, 10),
          evidenceQuotes: annotations.flatMap((row) => row.evidenceQuotes).slice(0, 8),
        },
        { model }
      );

      await upsertInvestigatorPortfolioSnapshot(supabase, {
        investigatorId: investigator.id,
        windowStart,
        windowEnd,
        nPublications: signalCounts.publications,
        nGrants: signalCounts.grants,
        nNews: signalCounts.news,
        nHonors: signalCounts.honors,
        nTrials: signalCounts.trials,
        nSocial: signalCounts.social,
        themeDistribution: themes,
        trajectoryMetrics,
        aiBrief,
        evidenceSourceItemIds: sourceItemIds.slice(0, 300),
        model,
      });
      await clearPortfolioAiFailure(supabase, dedupeKey);
      investigatorSucceeded += 1;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await recordPortfolioAiFailure(supabase, {
        dedupeKey,
        jobType: "snapshot_investigator",
        entityType: "investigator",
        entityId: investigator.id,
        model,
        windowStart,
        windowEnd,
        errorMessage: errMsg,
        errorPayload: { stage: "snapshot_investigator" },
        maxAttempts,
      });
      investigatorFailed += 1;
      failures.push(`investigator:${investigator.id}:${errMsg}`);
    }
  }

  const communityRows = bundle.watchedCommunities.slice(0, maxCommunities);
  const communityFailureMap = await fetchPortfolioAiFailureMap(
    supabase,
    communityRows.map((community) =>
      communitySnapshotDedupeKey(model, community.id, windowStart, windowEnd)
    )
  );
  for (const community of communityRows) {
    communityProcessed += 1;
    const dedupeKey = communitySnapshotDedupeKey(model, community.id, windowStart, windowEnd);
    const retryState = communityFailureMap.get(dedupeKey);
    if (shouldSkipForRetryControl(retryState, nowIso)) {
      if (retryState?.status === "exhausted") communityRetryExhausted += 1;
      else communityRetryDeferred += 1;
      continue;
    }
    try {
      const communityInvestigators = bundle.investigators.filter(
        (inv) => inv.communityId === community.id
      );
      if (communityInvestigators.length === 0) continue;
      const investigatorSet = new Set(communityInvestigators.map((inv) => inv.id));
      const items = windowItems.filter((item) =>
        item.investigatorIds.some((id) => investigatorSet.has(id))
      );
      if (items.length === 0) continue;
      const sourceItemIds = items.map((item) => item.id);
      const annotations = sourceItemIds.flatMap((id) => annotationsBySourceItem.get(id) ?? []);
      const themes = topCounts(annotations.flatMap((row) => row.themes), 15);
      const methods = topCounts(annotations.flatMap((row) => row.methods), 10);
      const diseases = topCounts(annotations.flatMap((row) => row.diseases), 10);
      const translationalMix = Object.fromEntries(
        topCounts(annotations.map((row) => row.translationalStage), 10).map((row) => [
          row.label,
          row.count,
        ])
      );

      const monthTotals = Array.from(
        items.reduce((map, item) => {
          map.set(item.monthKey, (map.get(item.monthKey) ?? 0) + 1);
          return map;
        }, new Map<string, number>())
      ).sort(([a], [b]) => a.localeCompare(b));
      const split = Math.max(1, Math.floor(monthTotals.length / 2));
      const priorTotal = monthTotals.slice(0, split).reduce((acc, [, count]) => acc + count, 0);
      const currentTotal = monthTotals.slice(split).reduce((acc, [, count]) => acc + count, 0);
      const momentumMetrics = {
        monthly_signal_counts: monthTotals.map(([month, count]) => ({ month, count })),
        prior_half_total: priorTotal,
        current_half_total: currentTotal,
        growth_pct:
          priorTotal <= 0 ? (currentTotal > 0 ? 100 : 0) : Math.round(((currentTotal - priorTotal) / priorTotal) * 100),
      };

      const fundingPlaybook = topCounts(annotations.flatMap((row) => row.fundingTags), 10).map(
        (row) => ({
          tag: row.label,
          count: row.count,
          pct: row.pct,
        })
      );
      const aiStrategyBrief = await synthesizeCommunityAiBrief(
        {
          communityName: community.name,
          investigatorCount: communityInvestigators.length,
          signalCount: items.length,
          topThemes: themes.map((row) => row.label).slice(0, 8),
          topMethods: methods.map((row) => row.label).slice(0, 8),
          topDiseases: diseases.map((row) => row.label).slice(0, 8),
          translationalMix,
          annotationSummaries: annotations
            .map((row) => row.summary)
            .filter(Boolean)
            .slice(0, 14),
        },
        { model }
      );

      await upsertCommunityIntelligenceSnapshot(supabase, {
        communityId: community.id,
        windowStart,
        windowEnd,
        nSignals: items.length,
        nInvestigators: communityInvestigators.length,
        themeDistribution: themes,
        momentumMetrics,
        aiStrategyBrief,
        fundingPlaybook,
        evidenceSourceItemIds: sourceItemIds.slice(0, 400),
        model,
      });
      await clearPortfolioAiFailure(supabase, dedupeKey);
      communitySucceeded += 1;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await recordPortfolioAiFailure(supabase, {
        dedupeKey,
        jobType: "snapshot_community",
        entityType: "community",
        entityId: community.id,
        model,
        windowStart,
        windowEnd,
        errorMessage: errMsg,
        errorPayload: { stage: "snapshot_community" },
        maxAttempts,
      });
      communityFailed += 1;
      failures.push(`community:${community.id}:${errMsg}`);
    }
  }

  revalidatePath("/portfolio-intelligence");
  return {
    ok: true as const,
    model,
    windowStart,
    windowEnd,
    investigator: {
      processed: investigatorProcessed,
      succeeded: investigatorSucceeded,
      failed: investigatorFailed,
      retryDeferred: investigatorRetryDeferred,
      retryExhausted: investigatorRetryExhausted,
    },
    community: {
      processed: communityProcessed,
      succeeded: communitySucceeded,
      failed: communityFailed,
      retryDeferred: communityRetryDeferred,
      retryExhausted: communityRetryExhausted,
    },
    failureSamples: failures.slice(0, 25),
  };
}
