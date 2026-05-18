import type { SupabaseClient } from "@supabase/supabase-js";

export async function startSyncJobLog(
  supabase: SupabaseClient,
  jobType: string,
  details: Record<string, unknown> = {}
): Promise<string | null> {
  const { data, error } = await supabase
    .from("sync_job_logs")
    .insert({
      job_type: jobType,
      status: "started",
      details,
    })
    .select("id")
    .single();
  if (error) return null;
  return data.id;
}

export async function finishSyncJobLog(
  supabase: SupabaseClient,
  id: string,
  ok: boolean,
  message?: string,
  details?: Record<string, unknown>
) {
  await supabase
    .from("sync_job_logs")
    .update({
      status: ok ? "success" : "error",
      message: message ?? null,
      finished_at: new Date().toISOString(),
      ...(details ? { details } : {}),
    })
    .eq("id", id);
}
