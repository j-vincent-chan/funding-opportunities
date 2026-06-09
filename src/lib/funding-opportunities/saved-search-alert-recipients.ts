import type { SupabaseClient } from "@supabase/supabase-js";

export type RdsgOwnerRecipient = {
  id: string;
  fullName: string;
  email: string | null;
};

export async function fetchActiveRdsgOwnersForAlerts(
  supabase: SupabaseClient
): Promise<RdsgOwnerRecipient[]> {
  const { data, error } = await supabase
    .from("rdsg_owners")
    .select("id, full_name, email")
    .eq("is_active", true)
    .order("full_name", { ascending: true })
    .limit(300);

  if (error) return [];

  return (data ?? []).map((row) => {
    const r = row as { id: string; full_name: string; email: string | null };
    return {
      id: r.id,
      fullName: String(r.full_name ?? "").trim(),
      email: r.email?.trim() || null,
    };
  });
}

/** Resolve unique lowercase recipient emails for a saved search alert. */
export async function resolveSavedSearchAlertRecipientEmails(
  supabase: SupabaseClient,
  input: {
    userId: string;
    alertRdsgOwnerIds: string[];
  }
): Promise<{ emails: string[]; warnings: string[] }> {
  const warnings: string[] = [];
  const emails = new Set<string>();

  const ownerIds = Array.from(new Set(input.alertRdsgOwnerIds.filter(Boolean)));
  if (ownerIds.length > 0) {
    const { data: owners, error } = await supabase
      .from("rdsg_owners")
      .select("id, full_name, email")
      .in("id", ownerIds)
      .eq("is_active", true);

    if (error) {
      warnings.push(`Load RDSG recipients: ${error.message}`);
    } else {
      for (const row of owners ?? []) {
        const o = row as { id: string; full_name: string; email: string | null };
        const email = o.email?.trim();
        if (email) {
          emails.add(email.toLowerCase());
        } else {
          warnings.push(`RDSG owner “${o.full_name}” has no email on file; skipped.`);
        }
      }
    }
  }

  if (emails.size === 0) {
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", input.userId)
      .maybeSingle();

    if (profileErr) {
      warnings.push(`Load profile email: ${profileErr.message}`);
    } else {
      const userEmail = (profile as { email?: string | null } | null)?.email?.trim();
      if (userEmail) emails.add(userEmail.toLowerCase());
    }
  }

  return { emails: Array.from(emails), warnings };
}

export function savedSearchDigestDue(
  alertFrequency: string | null | undefined,
  lastDigestSentAt: string | null | undefined,
  now = Date.now()
): boolean {
  const freq =
    alertFrequency === "instant" || alertFrequency === "daily" || alertFrequency === "weekly"
      ? alertFrequency
      : "weekly";

  if (freq === "instant") return true;

  const lastMs = lastDigestSentAt ? new Date(lastDigestSentAt).getTime() : NaN;
  if (!Number.isFinite(lastMs)) return true;

  const elapsedMs = now - lastMs;
  if (freq === "daily") return elapsedMs >= 24 * 3600 * 1000;
  return elapsedMs >= 7 * 24 * 3600 * 1000;
}
