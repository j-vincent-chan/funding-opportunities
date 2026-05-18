"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createSimplerGrantsClient } from "@/lib/ingestion/simpler-grants/client";
import {
  DEFAULT_MAX_NOFOS_PER_SYNC,
  syncSimplerGrantsToSupabase,
} from "@/lib/services/simpler-grants-sync";
import { extractOpportunityFeatures } from "@/lib/funding-opportunities/extract-opportunity-features";
import { buildRdSignalColumns } from "@/lib/funding-opportunities/rd-signals";
import { finishSyncJobLog, startSyncJobLog } from "@/lib/services/sync-job-log";

/** Form-friendly wrapper (returns void for Next.js <form action>). */
export async function syncFundingOpportunitiesForm(formData: FormData): Promise<void> {
  void formData;
  await syncFundingOpportunities();
}

const SYNC_PAGE_SIZE = 50;

function clampSyncMaxNofos(requested?: number): number {
  if (requested == null || Number.isNaN(requested)) return DEFAULT_MAX_NOFOS_PER_SYNC;
  return Math.min(DEFAULT_MAX_NOFOS_PER_SYNC, Math.max(1, Math.floor(requested)));
}

async function syncFundingOpportunitiesWithCap(maxNofosPerRun: number) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const client = createSimplerGrantsClient();
  if (!client) {
    return { error: "SIMPLER_GRANTS_API_KEY is not configured" };
  }

  const cap = clampSyncMaxNofos(maxNofosPerRun);
  const logId = await startSyncJobLog(supabase, "simpler_grants_sync", { maxNofosPerRun: cap });

  try {
    const result = await syncSimplerGrantsToSupabase(supabase, client, {
      pageSize: SYNC_PAGE_SIZE,
      maxNofosPerRun: cap,
    });
    if (logId) {
      await finishSyncJobLog(supabase, logId, result.errors.length === 0, undefined, {
        ...result,
        maxNofosPerRun: cap,
      });
    }
    revalidatePath("/funding-opportunities");
    return { ok: true as const, ...result, maxNofosPerRun: cap };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (logId) await finishSyncJobLog(supabase, logId, false, msg);
    return { error: msg };
  }
}

/** Full sync up to {@link DEFAULT_MAX_NOFOS_PER_SYNC} opportunities. */
export async function syncFundingOpportunities() {
  return syncFundingOpportunitiesWithCap(DEFAULT_MAX_NOFOS_PER_SYNC);
}

/** Test sync: only the first 10 opportunities (same API filters, smaller cap). */
export async function syncFundingOpportunitiesTest10() {
  return syncFundingOpportunitiesWithCap(10);
}

export async function extractOpportunityFeaturesAllForm(formData: FormData): Promise<void> {
  void formData;
  await extractOpportunityFeaturesAll();
}

export async function extractOpportunityFeaturesAll() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: opps, error } = await supabase.from("funding_opportunities").select("*");
  if (error) return { error: error.message };

  let n = 0;
  const errors: string[] = [];
  for (const o of opps ?? []) {
    const feats = extractOpportunityFeatures({
      title: o.title,
      description: o.description ?? "",
      category: o.category,
      funding_instrument: o.funding_instrument,
    });
    const { error: uErr } = await supabase.from("opportunity_features").upsert(
      {
        opportunity_id: o.id,
        ...feats,
      },
      { onConflict: "opportunity_id" }
    );
    if (uErr) {
      errors.push(`${o.id}: ${uErr.message}`);
      continue;
    }
    const rd = buildRdSignalColumns({
      title: o.title,
      description: o.description ?? "",
      opportunity_number: o.opportunity_number,
      agency: o.agency,
      agency_code: o.agency_code,
    });
    const { error: rdErr } = await supabase.from("funding_opportunities").update(rd).eq("id", o.id);
    if (rdErr) errors.push(`${o.id} rd: ${rdErr.message}`);
    else n += 1;
  }

  revalidatePath("/funding-opportunities");
  return { ok: true as const, extracted: n, errors };
}
