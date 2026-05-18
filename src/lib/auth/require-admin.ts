import type { SupabaseClient } from "@supabase/supabase-js";

export async function requireAdmin(supabase: SupabaseClient): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (profile?.role !== "admin") {
    return { ok: false, error: "Admin role required" };
  }
  return { ok: true, userId: user.id };
}
