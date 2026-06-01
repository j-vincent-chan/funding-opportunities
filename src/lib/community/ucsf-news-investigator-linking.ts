import type { SupabaseClient } from "@supabase/supabase-js";
import { enrichTextFromSourceUrl } from "@/lib/ai/source-document-url-enrichment";
import type { WatchlistInvestigator } from "@/lib/community/investigator-name-matching";
import {
  buildUcsfNewsNameMatchers,
  findUcsfNewsInvestigatorIdsInText,
} from "@/lib/community/ucsf-news-name-matching";

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_DELAY_MS = 250;
/** Appended to raw_summary after a watchlist name-matching pass (match or no match). */
export const WATCHLIST_SCANNED_MARKER = "watchlist_scanned";

export type LinkUcsfNewsToWatchlistResult = {
  watchlistSize: number;
  candidates: number;
  processed: number;
  linkedItems: number;
  linksWritten: number;
  fetchedPages: number;
  fetchFailed: number;
  errors: string[];
};

type UcsfNewsRow = {
  id: string;
  title: string | null;
  source_url: string | null;
  raw_text: string | null;
  raw_summary: string | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: { attempts?: number; baseDelayMs?: number }
): Promise<T> {
  const attempts = opts?.attempts ?? 4;
  const baseDelayMs = opts?.baseDelayMs ?? 800;
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i < attempts - 1) await sleep(baseDelayMs * 2 ** i);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function fetchWatchlistInvestigators(
  supabase: SupabaseClient
): Promise<WatchlistInvestigator[]> {
  const { data, error } = await supabase
    .from("investigators")
    .select("id,first_name,last_name,middle_initial,full_name")
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    firstName: String(row.first_name ?? "").trim(),
    lastName: String(row.last_name ?? "").trim(),
    middleInitial: row.middle_initial ? String(row.middle_initial).trim() : null,
    fullName: String(row.full_name ?? "").trim(),
  }));
}

async function fetchPendingUcsfNewsCandidateIds(
  supabase: SupabaseClient,
  maxItems: number,
  opts: { onlyUnlinked: boolean; watchlistIds: Set<string> }
): Promise<string[]> {
  const pageSize = 500;
  const pending: string[] = [];
  let from = 0;

  while (pending.length < maxItems) {
    const to = from + pageSize - 1;
    const { data, error } = await withRetry(async () =>
      supabase
        .from("community_source_items")
        .select("id")
        .eq("origin", "prospera")
        .like("prospera_cache_key", "ucsf-news:%")
        .not("raw_summary", "ilike", `%${WATCHLIST_SCANNED_MARKER}%`)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true })
        .range(from, to)
    );
    if (error) throw new Error(error.message);
    const page = (data ?? []) as { id: string }[];
    if (!page.length) break;

    let pageIds = page.map((row) => String(row.id));
    if (opts.onlyUnlinked && opts.watchlistIds.size > 0) {
      pageIds = await filterUnlinkedItemIds(supabase, pageIds, opts.watchlistIds);
    }
    pending.push(...pageIds);

    if (page.length < pageSize) break;
    from += pageSize;
  }

  return pending.slice(0, maxItems);
}

async function filterUnlinkedItemIds(
  supabase: SupabaseClient,
  itemIds: string[],
  watchlistIds: Set<string>
): Promise<string[]> {
  const linkedIds = new Set<string>();
  for (let i = 0; i < itemIds.length; i += 200) {
    const chunk = itemIds.slice(i, i + 200);
    const { data, error } = await withRetry(async () =>
      supabase
        .from("community_source_item_entities")
        .select("source_item_id,signal_entity_id")
        .in("source_item_id", chunk)
    );
    if (error) throw new Error(error.message);
    for (const link of data ?? []) {
      if (watchlistIds.has(String(link.signal_entity_id))) {
        linkedIds.add(String(link.source_item_id));
      }
    }
  }
  return itemIds.filter((id) => !linkedIds.has(id));
}

async function hydrateUcsfNewsRows(
  supabase: SupabaseClient,
  itemIds: string[]
): Promise<UcsfNewsRow[]> {
  const rows: UcsfNewsRow[] = [];
  for (let i = 0; i < itemIds.length; i += 100) {
    const chunk = itemIds.slice(i, i + 100);
    const { data, error } = await withRetry(async () =>
      supabase
        .from("community_source_items")
        .select("id,title,source_url,raw_text,raw_summary")
        .in("id", chunk)
    );
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as UcsfNewsRow[]));
  }
  const byId = new Map(rows.map((r) => [r.id, r]));
  return itemIds.map((id) => byId.get(id)).filter((r): r is UcsfNewsRow => Boolean(r));
}

async function fetchUcsfNewsCandidates(
  supabase: SupabaseClient,
  opts: { maxItems: number; onlyUnlinked: boolean; watchlistIds: Set<string> }
): Promise<UcsfNewsRow[]> {
  const selectedIds = await fetchPendingUcsfNewsCandidateIds(supabase, opts.maxItems, opts);
  return hydrateUcsfNewsRows(supabase, selectedIds);
}

function withWatchlistScannedSummary(rawSummary: string | null): string {
  const base = (rawSummary ?? "UCSF News").trim() || "UCSF News";
  if (base.includes(WATCHLIST_SCANNED_MARKER)) return base;
  return `${base} · ${WATCHLIST_SCANNED_MARKER}`;
}

function searchTextFromRow(row: UcsfNewsRow): string {
  return [row.title, row.raw_text].filter(Boolean).join("\n\n");
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  delayMs: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!, i);
      if (delayMs > 0 && i < items.length - 1) await sleep(delayMs);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

export async function linkUcsfNewsItemsToWatchlist(
  supabase: SupabaseClient,
  params?: {
    maxItems?: number;
    onlyUnlinked?: boolean;
    fetchArticleBodies?: boolean;
    concurrency?: number;
    delayMs?: number;
  }
): Promise<LinkUcsfNewsToWatchlistResult> {
  const maxItems = Math.max(1, Math.min(20000, params?.maxItems ?? 2000));
  const onlyUnlinked = params?.onlyUnlinked ?? true;
  const fetchArticleBodies = params?.fetchArticleBodies ?? true;
  const concurrency = Math.max(1, Math.min(12, params?.concurrency ?? DEFAULT_CONCURRENCY));
  const delayMs = Math.max(0, params?.delayMs ?? DEFAULT_DELAY_MS);

  const watchlist = await fetchWatchlistInvestigators(supabase);
  const watchlistIds = new Set(watchlist.map((w) => w.id));
  const matchers = buildUcsfNewsNameMatchers(watchlist);

  const candidates = await fetchUcsfNewsCandidates(supabase, {
    maxItems,
    onlyUnlinked,
    watchlistIds,
  });

  const result: LinkUcsfNewsToWatchlistResult = {
    watchlistSize: watchlist.length,
    candidates: candidates.length,
    processed: 0,
    linkedItems: 0,
    linksWritten: 0,
    fetchedPages: 0,
    fetchFailed: 0,
    errors: [],
  };

  if (candidates.length === 0 || matchers.length === 0) return result;

  const pushError = (message: string) => {
    if (result.errors.length < 30) result.errors.push(message);
  };

  await mapWithConcurrency(
    candidates,
    concurrency,
    delayMs,
    async (row) => {
      result.processed += 1;
      let searchText = searchTextFromRow(row);
      let rawTextUpdate: string | null = null;

      let investigatorIds = findUcsfNewsInvestigatorIdsInText(searchText, matchers);

      if (investigatorIds.length === 0 && fetchArticleBodies && row.source_url) {
        const enriched = await enrichTextFromSourceUrl(row.source_url);
        if (enriched.ok) {
          result.fetchedPages += 1;
          const body = [enriched.abstractText, enriched.fullText].filter(Boolean).join("\n\n");
          if (body) {
            rawTextUpdate = body.slice(0, 120_000);
            searchText = [row.title, body].filter(Boolean).join("\n\n");
            investigatorIds = findUcsfNewsInvestigatorIdsInText(searchText, matchers);
          }
        } else {
          result.fetchFailed += 1;
          if (result.fetchFailed <= 5) {
            pushError(`${row.id.slice(0, 8)}… fetch: ${enriched.error}`);
          }
        }
      }

      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        raw_summary: withWatchlistScannedSummary(row.raw_summary),
      };
      if (rawTextUpdate) patch.raw_text = rawTextUpdate;

      if (investigatorIds.length === 0) {
        const { error: scanErr } = await supabase
          .from("community_source_items")
          .update(patch)
          .eq("id", row.id);
        if (scanErr) pushError(`${row.id.slice(0, 8)}… mark scanned: ${scanErr.message}`);
        return;
      }

      const { error: delErr } = await supabase
        .from("community_source_item_entities")
        .delete()
        .eq("source_item_id", row.id)
        .in("signal_entity_id", [...watchlistIds]);
      if (delErr) {
        pushError(`${row.id.slice(0, 8)}… delete links: ${delErr.message}`);
        return;
      }

      const linkRows = investigatorIds.map((invId) => ({
        source_item_id: row.id,
        signal_entity_id: invId,
      }));
      const { error: linkErr } = await supabase
        .from("community_source_item_entities")
        .upsert(linkRows, { onConflict: "source_item_id,signal_entity_id" });
      if (linkErr) {
        pushError(`${row.id.slice(0, 8)}… upsert links: ${linkErr.message}`);
        return;
      }

      patch.raw_summary = withWatchlistScannedSummary(row.raw_summary);
      if (investigatorIds.length === 1) {
        patch.prospera_investigator_id = investigatorIds[0];
      }

      const { error: patchErr } = await supabase
        .from("community_source_items")
        .update(patch)
        .eq("id", row.id);
      if (patchErr) pushError(`${row.id.slice(0, 8)}… update item: ${patchErr.message}`);

      result.linkedItems += 1;
      result.linksWritten += linkRows.length;
    }
  );

  return result;
}

export type LinkUcsfNewsUntilExhaustedResult = LinkUcsfNewsToWatchlistResult & {
  rounds: number;
};

export async function linkUcsfNewsUntilExhausted(
  supabase: SupabaseClient,
  params?: {
    batchSize?: number;
    onlyUnlinked?: boolean;
    fetchArticleBodies?: boolean;
    maxRounds?: number;
  }
): Promise<LinkUcsfNewsUntilExhaustedResult> {
  const batchSize = Math.max(1, Math.min(20000, params?.batchSize ?? 2000));
  const maxRounds = Math.max(1, Math.min(500, params?.maxRounds ?? 200));
  const totals: LinkUcsfNewsUntilExhaustedResult = {
    rounds: 0,
    watchlistSize: 0,
    candidates: 0,
    processed: 0,
    linkedItems: 0,
    linksWritten: 0,
    fetchedPages: 0,
    fetchFailed: 0,
    errors: [],
  };

  for (let round = 0; round < maxRounds; round += 1) {
    const r = await linkUcsfNewsItemsToWatchlist(supabase, {
      maxItems: batchSize,
      onlyUnlinked: params?.onlyUnlinked ?? true,
      fetchArticleBodies: params?.fetchArticleBodies ?? true,
    });
    totals.rounds += 1;
    console.log(
      `[round ${totals.rounds}] candidates=${r.candidates} linked=${r.linkedItems} processed=${r.processed}`
    );
    totals.watchlistSize = r.watchlistSize;
    totals.candidates += r.candidates;
    totals.processed += r.processed;
    totals.linkedItems += r.linkedItems;
    totals.linksWritten += r.linksWritten;
    totals.fetchedPages += r.fetchedPages;
    totals.fetchFailed += r.fetchFailed;
    for (const err of r.errors) {
      if (totals.errors.length < 30) totals.errors.push(err);
    }
    if (r.candidates === 0) break;
  }

  return totals;
}

export function formatLinkUcsfNewsSummary(r: LinkUcsfNewsToWatchlistResult): string {
  return [
    `Watchlist investigators: ${r.watchlistSize}`,
    `Candidates scanned: ${r.candidates}`,
    `Processed: ${r.processed}`,
    `Items linked to ≥1 investigator: ${r.linkedItems}`,
    `Entity links written: ${r.linksWritten}`,
    `Article pages fetched: ${r.fetchedPages}`,
    `Fetch failures: ${r.fetchFailed}`,
    r.errors.length > 0 ? `Sample errors: ${r.errors.slice(0, 3).join(" | ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
