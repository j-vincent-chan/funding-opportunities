import type { SupabaseClient } from "@supabase/supabase-js";
import { createSimplerGrantsClient } from "@/lib/ingestion/simpler-grants/client";
import {
  DEFAULT_MAX_NOFOS_PER_SYNC,
  syncSimplerGrantsToSupabase,
  type SimplerSyncResult,
} from "@/lib/services/simpler-grants-sync";
import { finishSyncJobLog, startSyncJobLog } from "@/lib/services/sync-job-log";

const SYNC_PAGE_SIZE = 50;

export type SimplerGrantsSyncJobResult =
  | ({ ok: true } & SimplerSyncResult & { maxNofosPerRun: number })
  | { ok: false; error: string };

function clampSyncMaxNofos(requested?: number): number {
  if (requested == null || Number.isNaN(requested)) return DEFAULT_MAX_NOFOS_PER_SYNC;
  return Math.min(DEFAULT_MAX_NOFOS_PER_SYNC, Math.max(1, Math.floor(requested)));
}

/**
 * Pull NIH / federal notices from Simpler.Grants.gov into `funding_opportunities` (cron or admin).
 *
 * `enrichWithDetailFetch` defaults to `true` (one extra `GET /opportunities/{id}` per notice for
 * complete dates/instruments/award bounds). Automated cron runs should pass `false`: enriching
 * thousands of notices can take 10+ minutes and exceed Vercel's function `maxDuration`.
 */
export async function runSimplerGrantsSyncJob(
  supabase: SupabaseClient,
  opts: { maxNofosPerRun?: number; source?: string; enrichWithDetailFetch?: boolean } = {}
): Promise<SimplerGrantsSyncJobResult> {
  const client = createSimplerGrantsClient();
  if (!client) {
    return { ok: false, error: "SIMPLER_GRANTS_API_KEY is not configured" };
  }

  const cap = clampSyncMaxNofos(opts.maxNofosPerRun);
  const enrichWithDetailFetch = opts.enrichWithDetailFetch ?? true;
  const logId = await startSyncJobLog(supabase, "simpler_grants_sync", {
    maxNofosPerRun: cap,
    source: opts.source ?? "cron",
    enrichWithDetailFetch,
  });

  try {
    const result = await syncSimplerGrantsToSupabase(supabase, client, {
      pageSize: SYNC_PAGE_SIZE,
      maxNofosPerRun: cap,
      enrichWithDetailFetch,
    });
    if (logId) {
      await finishSyncJobLog(supabase, logId, result.errors.length === 0, undefined, {
        ...result,
        maxNofosPerRun: cap,
      });
    }
    return { ok: true, ...result, maxNofosPerRun: cap };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (logId) await finishSyncJobLog(supabase, logId, false, msg);
    return { ok: false, error: msg };
  }
}
