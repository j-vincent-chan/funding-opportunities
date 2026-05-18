import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityEntityType } from "@/lib/types/database";

export async function logActivity(
  supabase: SupabaseClient,
  input: {
    entityType: ActivityEntityType;
    entityId: string;
    userId: string | null;
    actionType: string;
    details?: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from("activity_log").insert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    user_id: input.userId,
    action_type: input.actionType,
    details: input.details ?? {},
  });
  if (error) throw error;
}
