import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CommunityIntelligenceSnapshotRow,
  InvestigatorPortfolioSnapshotRow,
  PortfolioAiJobFailureRow,
  SourceDocumentInput,
  SourceDocumentKind,
  SourceDocumentRow,
} from "@/lib/portfolio-intelligence/intelligence-types";
import type { PortfolioDocumentAnnotation } from "@/lib/ai/portfolio-document-extraction";

export type PortfolioAiJobType =
  | "annotation"
  | "snapshot_investigator"
  | "snapshot_community";

export type PortfolioAiEntityType = "document" | "investigator" | "community";

const SOURCE_DOCUMENT_UPSERT_BATCH_SIZE = 200;

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function checksumText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return `${hash}`;
}

function kindFromSource(input: SourceDocumentInput): SourceDocumentKind {
  const sourceType = (input.sourceType ?? "").toLowerCase();
  const category = (input.category ?? "").toLowerCase();
  if (category === "paper" || sourceType === "pubmed") {
    return input.fullText ? "paper_fulltext" : "paper_abstract";
  }
  if (category === "funding" || sourceType === "reporter") {
    return input.fullText ? "grant_fulltext" : "grant_abstract";
  }
  if (sourceType.includes("trial") || category.includes("trial")) return "clinical_trial_record";
  if (category === "media" || sourceType === "web") return "news_article";
  return "other";
}

export function chunkDocumentText(
  text: string,
  opts?: { maxChars?: number; overlapChars?: number }
): Array<{ chunkIndex: number; chunkText: string; tokenCountEstimate: number }> {
  const maxChars = Math.max(500, opts?.maxChars ?? 1800);
  const overlapChars = Math.max(0, Math.min(maxChars / 2, opts?.overlapChars ?? 220));
  const clean = normalizeWhitespace(text);
  if (!clean) return [];

  const chunks: Array<{ chunkIndex: number; chunkText: string; tokenCountEstimate: number }> = [];
  let cursor = 0;
  let index = 0;
  while (cursor < clean.length) {
    const end = Math.min(clean.length, cursor + maxChars);
    const slice = clean.slice(cursor, end);
    chunks.push({
      chunkIndex: index,
      chunkText: slice,
      tokenCountEstimate: Math.ceil(slice.length / 4),
    });
    if (end === clean.length) break;
    cursor = Math.max(end - overlapChars, cursor + 1);
    index += 1;
  }
  return chunks;
}

async function fetchSourceDocumentsForBatch(
  supabase: SupabaseClient,
  batch: Array<{ source_item_id: string; document_kind: string }>
): Promise<SourceDocumentRow[]> {
  const sourceItemIds = Array.from(new Set(batch.map((row) => row.source_item_id)));
  if (sourceItemIds.length === 0) return [];

  const { data, error } = await supabase
    .from("source_documents")
    .select("id,source_item_id,document_kind,title,abstract_text,full_text")
    .in("source_item_id", sourceItemIds);
  if (error) throw new Error(`source_documents fetch after upsert failed: ${error.message}`);

  const expected = new Set(
    batch.map((row) => `${row.source_item_id}:${row.document_kind}`)
  );
  return ((data ?? []) as SourceDocumentRow[]).filter((row) =>
    expected.has(`${row.source_item_id}:${row.document_kind}`)
  );
}

export async function upsertSourceDocumentsFromItems(
  supabase: SupabaseClient,
  items: SourceDocumentInput[]
): Promise<SourceDocumentRow[]> {
  if (items.length === 0) return [];
  const payload = items.map((item) => {
    const abstractText = item.summaryText ? normalizeWhitespace(item.summaryText) : null;
    const fullText = item.fullText ? normalizeWhitespace(item.fullText) : null;
    const basis = `${item.sourceItemId}|${item.title}|${abstractText ?? ""}|${fullText ?? ""}|${item.sourceUrl ?? ""}`;
    return {
      source_item_id: item.sourceItemId,
      document_kind: kindFromSource(item),
      title: normalizeWhitespace(item.title || "(untitled document)"),
      abstract_text: abstractText,
      full_text: fullText,
      source_url: item.sourceUrl ?? null,
      published_at: item.publishedAt ?? null,
      language: item.language ?? "en",
      license: item.license ?? null,
      raw_payload: item.rawPayload ?? {},
      checksum: checksumText(basis),
      ingested_at: new Date().toISOString(),
    };
  });

  const upserted: SourceDocumentRow[] = [];
  const batchCount = Math.ceil(payload.length / SOURCE_DOCUMENT_UPSERT_BATCH_SIZE);
  for (let i = 0; i < payload.length; i += SOURCE_DOCUMENT_UPSERT_BATCH_SIZE) {
    const batch = payload.slice(i, i + SOURCE_DOCUMENT_UPSERT_BATCH_SIZE);
    const batchIndex = Math.floor(i / SOURCE_DOCUMENT_UPSERT_BATCH_SIZE) + 1;
    const { error } = await supabase
      .from("source_documents")
      .upsert(batch, { onConflict: "source_item_id,document_kind" });
    if (error) {
      throw new Error(
        `source_documents upsert batch ${batchIndex}/${batchCount} failed: ${error.message}`
      );
    }
    const fetched = await fetchSourceDocumentsForBatch(supabase, batch);
    if (fetched.length < batch.length) {
      throw new Error(
        `source_documents upsert batch ${batchIndex}/${batchCount}: expected ${batch.length} rows, found ${fetched.length} after upsert (missing parent community_source_items or replication lag)`
      );
    }
    upserted.push(...fetched);
  }
  return upserted;
}

export async function replaceDocumentChunks(
  supabase: SupabaseClient,
  documentId: string,
  documentText: string
): Promise<number> {
  const docId = documentId.trim();
  if (!docId) return 0;

  const { data: parent, error: parentErr } = await supabase
    .from("source_documents")
    .select("id")
    .eq("id", docId)
    .maybeSingle();
  if (parentErr) throw new Error(parentErr.message);
  if (!parent?.id) {
    throw new Error(`source_documents row ${docId} not found — cannot write document_chunks`);
  }

  const chunks = chunkDocumentText(documentText);
  await supabase.from("document_chunks").delete().eq("document_id", docId);
  if (chunks.length === 0) return 0;
  const rows = chunks.map((chunk) => ({
    document_id: docId,
    chunk_index: chunk.chunkIndex,
    token_count: chunk.tokenCountEstimate,
    chunk_text: chunk.chunkText,
  }));
  const { error } = await supabase.from("document_chunks").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}

export async function fetchLatestInvestigatorSnapshotMap(
  supabase: SupabaseClient,
  investigatorIds: string[]
): Promise<Map<string, InvestigatorPortfolioSnapshotRow>> {
  const map = new Map<string, InvestigatorPortfolioSnapshotRow>();
  if (investigatorIds.length === 0) return map;
  const { data, error } = await supabase
    .from("investigator_portfolio_snapshots")
    .select(
      "id,investigator_id,window_start,window_end,ai_brief,theme_distribution,trajectory_metrics,evidence_source_item_ids,model,created_at"
    )
    .in("investigator_id", investigatorIds)
    .order("created_at", { ascending: false });
  if (error) return map;
  for (const row of (data ?? []) as InvestigatorPortfolioSnapshotRow[]) {
    if (!map.has(row.investigator_id)) map.set(row.investigator_id, row);
  }
  return map;
}

export async function fetchLatestCommunitySnapshotMap(
  supabase: SupabaseClient,
  communityIds: string[]
): Promise<Map<string, CommunityIntelligenceSnapshotRow>> {
  const map = new Map<string, CommunityIntelligenceSnapshotRow>();
  if (communityIds.length === 0) return map;
  const { data, error } = await supabase
    .from("community_intelligence_snapshots")
    .select(
      "id,community_id,window_start,window_end,ai_strategy_brief,theme_distribution,momentum_metrics,funding_playbook,evidence_source_item_ids,model,created_at"
    )
    .in("community_id", communityIds)
    .order("created_at", { ascending: false });
  if (error) return map;
  for (const row of (data ?? []) as CommunityIntelligenceSnapshotRow[]) {
    if (row.community_id && !map.has(row.community_id)) map.set(row.community_id, row);
  }
  return map;
}

export async function upsertDocumentAnnotation(
  supabase: SupabaseClient,
  documentId: string,
  model: string,
  annotation: PortfolioDocumentAnnotation
): Promise<void> {
  const payload = {
    document_id: documentId,
    model,
    summary: annotation.summary,
    themes: annotation.themes,
    methods: annotation.methods,
    diseases: annotation.diseases,
    translational_stage: annotation.translational_stage,
    funding_relevance_tags: annotation.funding_relevance_tags,
    evidence_quotes: annotation.evidence_quotes,
    confidence: annotation.confidence,
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("document_ai_annotations")
    .upsert(payload, { onConflict: "document_id,model" });
  if (error) throw new Error(error.message);
}

export async function upsertInvestigatorPortfolioSnapshot(
  supabase: SupabaseClient,
  payload: {
    investigatorId: string;
    windowStart: string;
    windowEnd: string;
    nPublications: number;
    nGrants: number;
    nNews: number;
    nHonors: number;
    nTrials: number;
    nSocial: number;
    themeDistribution: unknown;
    trajectoryMetrics: unknown;
    aiBrief: string | null;
    evidenceSourceItemIds: string[];
    model: string;
  }
): Promise<void> {
  const { error } = await supabase.from("investigator_portfolio_snapshots").upsert(
    {
      investigator_id: payload.investigatorId,
      window_start: payload.windowStart,
      window_end: payload.windowEnd,
      n_publications: payload.nPublications,
      n_grants: payload.nGrants,
      n_news: payload.nNews,
      n_honors: payload.nHonors,
      n_trials: payload.nTrials,
      n_social: payload.nSocial,
      theme_distribution: payload.themeDistribution,
      trajectory_metrics: payload.trajectoryMetrics,
      ai_brief: payload.aiBrief,
      evidence_source_item_ids: payload.evidenceSourceItemIds,
      model: payload.model,
      created_at: new Date().toISOString(),
    },
    { onConflict: "investigator_id,window_start,window_end,model" }
  );
  if (error) throw new Error(error.message);
}

export async function upsertCommunityIntelligenceSnapshot(
  supabase: SupabaseClient,
  payload: {
    communityId: string | null;
    windowStart: string;
    windowEnd: string;
    nSignals: number;
    nInvestigators: number;
    themeDistribution: unknown;
    momentumMetrics: unknown;
    aiStrategyBrief: string | null;
    fundingPlaybook: unknown;
    evidenceSourceItemIds: string[];
    model: string;
  }
): Promise<void> {
  const { error } = await supabase.from("community_intelligence_snapshots").upsert(
    {
      community_id: payload.communityId,
      window_start: payload.windowStart,
      window_end: payload.windowEnd,
      n_signals: payload.nSignals,
      n_investigators: payload.nInvestigators,
      theme_distribution: payload.themeDistribution,
      momentum_metrics: payload.momentumMetrics,
      ai_strategy_brief: payload.aiStrategyBrief,
      funding_playbook: payload.fundingPlaybook,
      evidence_source_item_ids: payload.evidenceSourceItemIds,
      model: payload.model,
      created_at: new Date().toISOString(),
    },
    { onConflict: "community_id,window_start,window_end,model" }
  );
  if (error) throw new Error(error.message);
}

export async function fetchPortfolioAiFailureMap(
  supabase: SupabaseClient,
  dedupeKeys: string[]
): Promise<Map<string, PortfolioAiJobFailureRow>> {
  const map = new Map<string, PortfolioAiJobFailureRow>();
  if (dedupeKeys.length === 0) return map;
  const { data, error } = await supabase
    .from("portfolio_ai_job_failures")
    .select(
      "id,dedupe_key,job_type,entity_type,entity_id,model,window_start,window_end,attempt_count,status,first_failed_at,last_failed_at,next_retry_at,error_message,error_payload,recovered_at,created_at,updated_at"
    )
    .in("dedupe_key", dedupeKeys);
  if (error) {
    return map;
  }
  for (const row of (data ?? []) as PortfolioAiJobFailureRow[]) {
    map.set(row.dedupe_key, row);
  }
  return map;
}

export async function recordPortfolioAiFailure(
  supabase: SupabaseClient,
  payload: {
    dedupeKey: string;
    jobType: PortfolioAiJobType;
    entityType: PortfolioAiEntityType;
    entityId: string;
    model: string;
    windowStart?: string | null;
    windowEnd?: string | null;
    errorMessage: string;
    errorPayload?: Record<string, unknown>;
    maxAttempts: number;
  }
): Promise<PortfolioAiJobFailureRow> {
  const existing = await fetchPortfolioAiFailureMap(supabase, [payload.dedupeKey]);
  const prior = existing.get(payload.dedupeKey);
  const nextAttempts = Math.min(1000, (prior?.attempt_count ?? 0) + 1);
  const exhausted = nextAttempts >= payload.maxAttempts;
  const backoffMinutes = Math.min(24 * 60, Math.pow(2, Math.max(0, nextAttempts - 1)) * 10);
  const nextRetryAt = exhausted ? null : new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
  const rowPayload = {
    dedupe_key: payload.dedupeKey,
    job_type: payload.jobType,
    entity_type: payload.entityType,
    entity_id: payload.entityId,
    model: payload.model,
    window_start: payload.windowStart ?? null,
    window_end: payload.windowEnd ?? null,
    attempt_count: nextAttempts,
    status: exhausted ? ("exhausted" as const) : ("open" as const),
    first_failed_at: prior?.first_failed_at ?? new Date().toISOString(),
    last_failed_at: new Date().toISOString(),
    next_retry_at: nextRetryAt,
    error_message: payload.errorMessage,
    error_payload: payload.errorPayload ?? {},
    recovered_at: null,
  };
  const { data, error } = await supabase
    .from("portfolio_ai_job_failures")
    .upsert(rowPayload, { onConflict: "dedupe_key" })
    .select(
      "id,dedupe_key,job_type,entity_type,entity_id,model,window_start,window_end,attempt_count,status,first_failed_at,last_failed_at,next_retry_at,error_message,error_payload,recovered_at,created_at,updated_at"
    )
    .single();
  if (error) {
    return {
      id: "",
      dedupe_key: payload.dedupeKey,
      job_type: payload.jobType,
      entity_type: payload.entityType,
      entity_id: payload.entityId,
      model: payload.model,
      window_start: payload.windowStart ?? null,
      window_end: payload.windowEnd ?? null,
      attempt_count: nextAttempts,
      status: exhausted ? "exhausted" : "open",
      first_failed_at: rowPayload.first_failed_at,
      last_failed_at: rowPayload.last_failed_at,
      next_retry_at: nextRetryAt,
      error_message: payload.errorMessage,
      error_payload: payload.errorPayload ?? {},
      recovered_at: null,
      created_at: rowPayload.last_failed_at,
      updated_at: rowPayload.last_failed_at,
    } as PortfolioAiJobFailureRow;
  }
  return data as PortfolioAiJobFailureRow;
}

export async function clearPortfolioAiFailure(
  supabase: SupabaseClient,
  dedupeKey: string
): Promise<void> {
  const existing = await fetchPortfolioAiFailureMap(supabase, [dedupeKey]);
  const prior = existing.get(dedupeKey);
  if (!prior) return;
  const { error } = await supabase
    .from("portfolio_ai_job_failures")
    .update({
      status: "resolved",
      recovered_at: new Date().toISOString(),
      next_retry_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("dedupe_key", dedupeKey);
  if (error) return;
}
