import type { SupabaseClient } from "@supabase/supabase-js";
import { extractPortfolioDocumentAnnotation } from "@/lib/ai/portfolio-document-extraction";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import {
  clearPortfolioAiFailure,
  fetchPortfolioAiFailureMap,
  recordPortfolioAiFailure,
  upsertDocumentAnnotation,
} from "@/lib/portfolio-intelligence/intelligence-pipeline";
import type { SourceDocumentRow } from "@/lib/portfolio-intelligence/intelligence-types";

const SUPABASE_PAGE_SIZE = 1000;
const DEFAULT_MODEL = "gpt-4o-mini";
const PREFETCH_MAX_ANNOTATIONS = 250_000;

export const MAX_ANNOTATE_DOCUMENTS = 100_000;
export const DEFAULT_ANNOTATION_BATCH_SIZE = 2000;
export const ANNOTATION_CONCURRENCY_PRESETS = [1, 6, 32] as const;
export type AnnotationConcurrencyPreset = (typeof ANNOTATION_CONCURRENCY_PRESETS)[number];
export const DEFAULT_ANNOTATION_CONCURRENCY: AnnotationConcurrencyPreset = 6;
export const MAX_ANNOTATION_CONCURRENCY = 32;

export type PortfolioAnnotationBatchResult = {
  model: string;
  processed: number;
  candidates: number;
  succeeded: number;
  skipped: number;
  skippedNoText: number;
  skippedAlreadyAnnotated: number;
  retryDeferred: number;
  retryExhausted: number;
  failed: number;
  failures: Array<{ documentId: string; title: string; error: string }>;
  concurrency: number;
  offset: number;
};

export type RunPortfolioAnnotationBatchOpts = {
  limit?: number;
  offset?: number;
  model?: string;
  skipAlreadyAnnotated?: boolean;
  maxAttempts?: number;
  concurrency?: AnnotationConcurrencyPreset;
};

function isConcurrencyPreset(n: number): n is AnnotationConcurrencyPreset {
  return (ANNOTATION_CONCURRENCY_PRESETS as readonly number[]).includes(n);
}

/** Resolve parallel LLM workers; only presets 1, 6, or 32 are allowed. */
export function resolveAnnotationConcurrency(value?: number): AnnotationConcurrencyPreset {
  if (value != null && isConcurrencyPreset(value)) return value;

  const env = process.env.PORTFOLIO_ANNOTATE_CONCURRENCY?.trim();
  const fromEnv = env ? parseInt(env, 10) : NaN;
  if (isConcurrencyPreset(fromEnv)) return fromEnv;

  return DEFAULT_ANNOTATION_CONCURRENCY;
}

export function annotationDedupeKey(model: string, documentId: string): string {
  return `annotation:${model}:${documentId}`;
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

function isRateLimitError(message: string): boolean {
  return /\b429\b|rate limit/i.test(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientFetchError(message: string): boolean {
  return /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|network/i.test(message);
}

async function withTransientRetries<T>(
  label: string,
  fn: () => Promise<T>,
  maxAttempts = 5
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!isTransientFetchError(msg) || attempt >= maxAttempts) break;
      await sleep(Math.min(30_000, 1500 * 2 ** (attempt - 1)));
    }
  }
  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`${label}: ${msg}`);
}

async function fetchSourceDocumentSlice(
  supabase: SupabaseClient,
  opts: { limit: number; offset: number }
): Promise<{ rows: SourceDocumentRow[]; error: string | null }> {
  const rows: SourceDocumentRow[] = [];
  let from = opts.offset;

  while (rows.length < opts.limit) {
    const remaining = opts.limit - rows.length;
    const pageSize = Math.min(SUPABASE_PAGE_SIZE, remaining);
    const to = from + pageSize - 1;
    const res = await supabase
      .from("source_documents")
      .select(
        "id,source_item_id,document_kind,title,abstract_text,full_text,source_url,published_at,language,license,raw_payload,checksum,ingested_at,updated_at"
      )
      .order("ingested_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to);

    if (res.error) return { rows, error: res.error.message };

    const page = (res.data ?? []) as SourceDocumentRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return { rows, error: null };
}

/** Paginate all annotations for a model (avoids dozens of `.in(document_id, …)` calls on large batches). */
async function fetchAllAnnotatedDocumentIdsForModel(
  supabase: SupabaseClient,
  model: string
): Promise<Set<string>> {
  return withTransientRetries("annotation exists prefetch", async () => {
    const { data, error } = await fetchAllRows<{ document_id: string }>(
      async (from, to) => {
        const res = await supabase
          .from("document_ai_annotations")
          .select("document_id")
          .eq("model", model)
          .order("document_id", { ascending: true })
          .range(from, to);
        return {
          data: (res.data ?? []) as { document_id: string }[],
          error: res.error ? { message: res.error.message } : null,
        };
      },
      { maxRows: PREFETCH_MAX_ANNOTATIONS }
    );
    if (error) throw new Error(error);
    const annotated = new Set<string>();
    for (const row of data) {
      if (row.document_id) annotated.add(String(row.document_id));
    }
    return annotated;
  });
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      await worker(items[index]!, index);
    }
  }

  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => runWorker()));
}

/**
 * Annotate a slice of source_documents with bounded parallel OpenAI calls.
 * Use offset + repeated batches (CLI) to walk the full table without rescanning the same newest rows.
 */
export async function runPortfolioDocumentAnnotationBatch(
  supabase: SupabaseClient,
  opts: RunPortfolioAnnotationBatchOpts = {}
): Promise<PortfolioAnnotationBatchResult> {
  const limit = Math.max(1, Math.min(MAX_ANNOTATE_DOCUMENTS, opts.limit ?? 200));
  const offset = Math.max(0, opts.offset ?? 0);
  const model = (opts.model ?? DEFAULT_MODEL).trim();
  const skipAlreadyAnnotated = opts.skipAlreadyAnnotated ?? true;
  const maxAttempts = Math.max(1, Math.min(10, opts.maxAttempts ?? 3));
  const concurrency = resolveAnnotationConcurrency(opts.concurrency);

  const slice = await fetchSourceDocumentSlice(supabase, { limit, offset });
  if (slice.error) {
    throw new Error(slice.error);
  }

  const docs = slice.rows;
  const nowIso = new Date().toISOString();
  const failureMap = await fetchPortfolioAiFailureMap(
    supabase,
    docs.map((doc) => annotationDedupeKey(model, doc.id))
  );

  let annotatedSet: Set<string> | null = null;
  if (skipAlreadyAnnotated) {
    annotatedSet = await fetchAllAnnotatedDocumentIdsForModel(supabase, model);
  }

  const failures: Array<{ documentId: string; title: string; error: string }> = [];
  let skipped = 0;
  let skippedNoText = 0;
  let skippedAlreadyAnnotated = 0;
  let retryDeferred = 0;
  let retryExhausted = 0;

  const candidates: SourceDocumentRow[] = [];
  for (const doc of docs) {
    const dedupeKey = annotationDedupeKey(model, doc.id);
    const retryState = failureMap.get(dedupeKey);
    if (shouldSkipForRetryControl(retryState, nowIso)) {
      skipped += 1;
      if (retryState?.status === "exhausted") retryExhausted += 1;
      else retryDeferred += 1;
      continue;
    }
    const text = (doc.full_text ?? doc.abstract_text ?? "").trim();
    if (!text) {
      skipped += 1;
      skippedNoText += 1;
      continue;
    }
    if (skipAlreadyAnnotated && annotatedSet?.has(doc.id)) {
      skipped += 1;
      skippedAlreadyAnnotated += 1;
      continue;
    }
    candidates.push(doc);
  }

  const succeededFlags: boolean[] = [];
  let failedCount = 0;

  await runPool(candidates, concurrency, async (doc, index) => {
    const dedupeKey = annotationDedupeKey(model, doc.id);
    try {
      const annotation = await extractPortfolioDocumentAnnotation(doc, { model });
      await upsertDocumentAnnotation(supabase, doc.id, model, annotation);
      await clearPortfolioAiFailure(supabase, dedupeKey);
      succeededFlags[index] = true;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      if (isRateLimitError(errMsg)) {
        await new Promise((r) => setTimeout(r, 4000));
      }
      await recordPortfolioAiFailure(supabase, {
        dedupeKey,
        jobType: "annotation",
        entityType: "document",
        entityId: doc.id,
        model,
        errorMessage: errMsg,
        errorPayload: { stage: "annotation_or_upsert" },
        maxAttempts,
      });
      failedCount += 1;
      if (failures.length < 50) {
        failures.push({
          documentId: doc.id,
          title: doc.title,
          error: errMsg,
        });
      }
    }
  });

  const succeeded = succeededFlags.filter(Boolean).length;

  return {
    model,
    processed: docs.length,
    candidates: candidates.length,
    succeeded,
    skipped,
    skippedNoText,
    skippedAlreadyAnnotated,
    retryDeferred,
    retryExhausted,
    failed: failedCount,
    failures,
    concurrency,
    offset,
  };
}

export function formatPortfolioAnnotationBatchSummary(r: PortfolioAnnotationBatchResult): string {
  return [
    `offset ${r.offset} · concurrency ${r.concurrency} · model ${r.model}`,
    `processed ${r.processed} · LLM candidates ${r.candidates} · succeeded ${r.succeeded}`,
    `skipped ${r.skipped} (no text ${r.skippedNoText}, already annotated ${r.skippedAlreadyAnnotated}, retry deferred ${r.retryDeferred}, exhausted ${r.retryExhausted})`,
    `failed ${r.failed}`,
  ].join("\n");
}
