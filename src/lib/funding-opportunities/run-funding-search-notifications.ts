import type { SupabaseClient } from "@supabase/supabase-js";
import { sendFundingSearchDigestEmail } from "@/lib/email/send-funding-search-digest";
import { fetchRecentMatchingOpportunitiesForSavedSearch } from "@/lib/funding-opportunities/funding-search-notification-query";
import { parseSavedFundingListState } from "@/lib/funding-opportunities/saved-funding-list-state";

const LOOKBACK_HOURS = 72;

export type FundingSearchNotificationJobResult = {
  subscriptions: number;
  skippedNoEmailProvider: boolean;
  emailsSent: number;
  emailsFailed: number;
  opportunityMatchesConsidered: number;
  warnings: string[];
};

export async function runFundingSearchNotificationsJob(
  supabase: SupabaseClient
): Promise<FundingSearchNotificationJobResult> {
  const warnings: string[] = [];
  const hasResend = !!(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim());
  if (!hasResend) {
    warnings.push("RESEND_API_KEY / RESEND_FROM_EMAIL not set — skipping sends.");
  }

  const sinceIso = new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000).toISOString();

  const { data: subs, error: subErr } = await supabase
    .from("saved_funding_searches")
    .select("id, name, state, user_id")
    .eq("email_notifications_enabled", true);

  if (subErr) {
    warnings.push(`Load subscriptions: ${subErr.message}`);
    return {
      subscriptions: 0,
      skippedNoEmailProvider: !hasResend,
      emailsSent: 0,
      emailsFailed: 0,
      opportunityMatchesConsidered: 0,
      warnings,
    };
  }

  const userIds = Array.from(new Set((subs ?? []).map((s) => (s as { user_id: string }).user_id)));
  const emailByUser = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: profs, error: pErr } = await supabase.from("profiles").select("id, email").in("id", userIds);
    if (pErr) warnings.push(`Load profiles: ${pErr.message}`);
    for (const p of profs ?? []) {
      const row = p as { id: string; email: string | null };
      emailByUser.set(row.id, row.email);
    }
  }

  let emailsSent = 0;
  let emailsFailed = 0;
  let opportunityMatchesConsidered = 0;

  for (const row of subs ?? []) {
    const rid = row as {
      id: string;
      name: string;
      state: unknown;
      user_id: string;
    };
    const toEmail = emailByUser.get(rid.user_id);
    if (!toEmail?.trim()) {
      warnings.push(`Saved search ${rid.id}: no profile email; skip.`);
      continue;
    }

    const state = parseSavedFundingListState(rid.state);
    if (!state) {
      warnings.push(`Saved search ${rid.id}: invalid state JSON; skip.`);
      continue;
    }

    const { rows, warning } = await fetchRecentMatchingOpportunitiesForSavedSearch(supabase, state, sinceIso);
    if (warning) warnings.push(`Saved search ${rid.id}: ${warning}`);

    if (rows.length === 0) continue;

    const ids = rows.map((r) => r.id);
    const { data: already } = await supabase
      .from("saved_funding_search_notification_sends")
      .select("opportunity_id")
      .eq("saved_search_id", rid.id)
      .in("opportunity_id", ids);

    const sentSet = new Set((already ?? []).map((a) => (a as { opportunity_id: string }).opportunity_id));
    const fresh = rows.filter((r) => !sentSet.has(r.id));
    if (fresh.length === 0) continue;

    opportunityMatchesConsidered += fresh.length;

    if (!hasResend) continue;

    const send = await sendFundingSearchDigestEmail({
      to: toEmail.trim(),
      searchName: rid.name,
      lines: fresh.map((r) => ({
        id: r.id,
        title: r.title,
        agency: r.agency,
        opportunityNumber: r.opportunity_number,
      })),
    });

    if (!send.ok) {
      emailsFailed += 1;
      warnings.push(`Email failed for saved search ${rid.id}: ${send.error}`);
      continue;
    }

    const inserts = fresh.map((r) => ({
      saved_search_id: rid.id,
      opportunity_id: r.id,
    }));

    let logOk = true;
    const chunkSize = 200;
    for (let i = 0; i < inserts.length; i += chunkSize) {
      const chunk = inserts.slice(i, i + chunkSize);
      const { error: insErr } = await supabase.from("saved_funding_search_notification_sends").insert(chunk);
      if (insErr) {
        emailsFailed += 1;
        warnings.push(`Log sends failed for ${rid.id}: ${insErr.message}`);
        logOk = false;
        break;
      }
    }
    if (!logOk) continue;

    emailsSent += 1;
  }

  return {
    subscriptions: (subs ?? []).length,
    skippedNoEmailProvider: !hasResend,
    emailsSent,
    emailsFailed,
    opportunityMatchesConsidered,
    warnings,
  };
}
