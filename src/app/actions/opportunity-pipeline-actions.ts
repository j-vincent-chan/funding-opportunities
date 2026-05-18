"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendTransactionalTextEmail } from "@/lib/email/send-transactional-text";
import { coercePlainTextFromUnknown } from "@/lib/formatting/coerce-plain-text";
import { formatDate } from "@/lib/formatting/dates";
import { createClient } from "@/lib/supabase/server";
import { buildOutreachEmailDraft } from "@/lib/opportunity-pipeline/email-drafts";
import {
  CLOSURE_REASONS,
  OUTREACH_STATUSES,
  PIPELINE_STAGES,
  ROLE_SUGGESTIONS,
  STRATEGIC_VALUES,
  MATCH_STRENGTHS,
  MATCH_PRIORITIES,
  type EmailDraftMode,
  EMAIL_DRAFT_MODES,
} from "@/lib/opportunity-pipeline/constants";
import { computeDefaultColdUntil } from "@/lib/opportunity-pipeline/cold-archive";

const uuid = z.string().uuid();

function revalidatePipeline(opportunityId: string) {
  revalidatePath("/match/saved");
  revalidatePath(`/match/saved/${opportunityId}`);
  revalidatePath("/funding-opportunities");
  revalidatePath(`/funding-opportunities/${opportunityId}`);
}

async function logActivity(
  supabase: ReturnType<typeof createClient>,
  input: {
    userId: string;
    opportunityId: string;
    eventType: string;
    payload: Record<string, unknown>;
    actorId: string | null;
  }
) {
  await supabase.from("saved_opportunity_activity").insert({
    user_id: input.userId,
    opportunity_id: input.opportunityId,
    event_type: input.eventType,
    payload: input.payload,
    created_by: input.actorId,
  });
}

async function recalcOutreachAggregates(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  opportunityId: string
) {
  const { data: rows } = await supabase
    .from("saved_opportunity_pi_matches")
    .select("outreach_status, outreach_sent_at")
    .eq("user_id", userId)
    .eq("opportunity_id", opportunityId);

  const counted = new Set(["sent", "responded_interested", "responded_maybe", "responded_declined"]);
  let count = 0;
  let last: string | null = null;
  for (const r of rows ?? []) {
    const st = String((r as { outreach_status?: string }).outreach_status ?? "");
    if (counted.has(st)) {
      count += 1;
      const sentAt = (r as { outreach_sent_at?: string | null }).outreach_sent_at;
      if (sentAt && (!last || sentAt > last)) last = sentAt;
    }
  }

  await supabase
    .from("saved_funding_opportunities")
    .update({
      outreach_count: count,
      last_outreach_at: last,
      last_activity_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("opportunity_id", opportunityId);
}

const stageSchema = z.enum(PIPELINE_STAGES);
const strategicSchema = z.enum(STRATEGIC_VALUES);
const closureSchema = z.enum(CLOSURE_REASONS).nullable();

export async function updateSavedOpportunityPipelineAction(input: {
  opportunityId: string;
  stage?: string;
  strategicValue?: string;
  ownerId?: string | null;
  internalNotes?: string | null;
  whyMatters?: string | null;
  risksBarriers?: string | null;
  areaProgramTags?: string[];
  nextAction?: string | null;
  nextActionDate?: string | null;
  closureReason?: string | null;
  coldUntil?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const oppId = uuid.safeParse(input.opportunityId);
  if (!oppId.success) return { ok: false, error: "Invalid opportunity." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const { data: existing, error: selErr } = await supabase
    .from("saved_funding_opportunities")
    .select(
      "stage, strategic_value, owner_id, closure_reason, next_action, next_action_date"
    )
    .eq("user_id", user.id)
    .eq("opportunity_id", oppId.data)
    .maybeSingle();

  if (selErr) return { ok: false, error: selErr.message };
  if (!existing) return { ok: false, error: "Saved opportunity not found." };

  const patch: Record<string, unknown> = {};

  if (input.stage !== undefined) {
    const p = stageSchema.safeParse(input.stage);
    if (!p.success) return { ok: false, error: "Invalid stage." };
    patch.stage = p.data;
    if (p.data !== "archived") patch.closure_reason = null;
    if (p.data !== "cold") {
      patch.cold_until = null;
    }
  }
  if (input.strategicValue !== undefined) {
    const p = strategicSchema.safeParse(input.strategicValue);
    if (!p.success) return { ok: false, error: "Invalid strategic value." };
    patch.strategic_value = p.data;
  }
  if (input.ownerId !== undefined) {
    if (input.ownerId === null || input.ownerId === "") patch.owner_id = null;
    else {
      const o = uuid.safeParse(input.ownerId);
      if (!o.success) return { ok: false, error: "Invalid owner." };
      const { data: ownerExists, error: ownerErr } = await supabase
        .from("rdsg_owners")
        .select("id")
        .eq("id", o.data)
        .eq("is_active", true)
        .maybeSingle();
      if (ownerErr) return { ok: false, error: ownerErr.message };
      if (!ownerExists) return { ok: false, error: "Owner is no longer available." };
      patch.owner_id = o.data;
    }
  }
  if (input.internalNotes !== undefined) patch.internal_notes = input.internalNotes;
  if (input.whyMatters !== undefined) patch.why_matters = input.whyMatters;
  if (input.risksBarriers !== undefined) patch.risks_barriers = input.risksBarriers;
  if (input.areaProgramTags !== undefined) patch.area_program_tags = input.areaProgramTags;
  if (input.nextAction !== undefined) patch.next_action = input.nextAction;
  if (input.nextActionDate !== undefined) {
    if (input.nextActionDate === null || input.nextActionDate === "") patch.next_action_date = null;
    else patch.next_action_date = input.nextActionDate;
  }
  if (input.closureReason !== undefined) {
    if (input.closureReason === null || input.closureReason === "") patch.closure_reason = null;
    else {
      const c = closureSchema.safeParse(input.closureReason);
      if (!c.success) return { ok: false, error: "Invalid closure reason." };
      patch.closure_reason = c.data;
    }
  }
  if (input.coldUntil !== undefined) {
    if (input.coldUntil === null || input.coldUntil === "") patch.cold_until = null;
    else patch.cold_until = input.coldUntil;
  }

  if (Object.keys(patch).length === 0) return { ok: true };

  patch.last_activity_at = new Date().toISOString();

  const { error: upErr } = await supabase
    .from("saved_funding_opportunities")
    .update(patch)
    .eq("user_id", user.id)
    .eq("opportunity_id", oppId.data);

  if (upErr) return { ok: false, error: upErr.message };

  const prevStage = (existing as { stage: string }).stage;
  if (patch.stage !== undefined && patch.stage !== prevStage) {
    await logActivity(supabase, {
      userId: user.id,
      opportunityId: oppId.data,
      eventType: "stage_change",
      payload: {
        from: prevStage,
        to: patch.stage,
        closure_reason:
          patch.stage === "archived"
            ? (patch.closure_reason ?? (existing as { closure_reason?: string | null }).closure_reason)
            : null,
      },
      actorId: user.id,
    });
  } else if (Object.keys(patch).some((k) => k !== "last_activity_at")) {
    await logActivity(supabase, {
      userId: user.id,
      opportunityId: oppId.data,
      eventType: "pipeline_update",
      payload: { fields: Object.keys(patch).filter((k) => k !== "last_activity_at") },
      actorId: user.id,
    });
  }

  revalidatePipeline(oppId.data);
  return { ok: true };
}

export async function appendPipelineTimelineNoteAction(input: {
  opportunityId: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const oppId = uuid.safeParse(input.opportunityId);
  if (!oppId.success) return { ok: false, error: "Invalid opportunity." };
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Note is empty." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const { data: row } = await supabase
    .from("saved_funding_opportunities")
    .select("opportunity_id")
    .eq("user_id", user.id)
    .eq("opportunity_id", oppId.data)
    .maybeSingle();
  if (!row) return { ok: false, error: "Not found." };

  await logActivity(supabase, {
    userId: user.id,
    opportunityId: oppId.data,
    eventType: "note",
    payload: { body },
    actorId: user.id,
  });

  await supabase
    .from("saved_funding_opportunities")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("opportunity_id", oppId.data);

  revalidatePipeline(oppId.data);
  return { ok: true };
}

export async function addSavedOpportunityPiMatchAction(input: {
  opportunityId: string;
  investigatorId: string;
  matchStrength?: string;
  matchPriority?: string;
  rationale?: string | null;
  roleSuggestion?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const oppId = uuid.safeParse(input.opportunityId);
  const invId = uuid.safeParse(input.investigatorId);
  if (!oppId.success || !invId.success) return { ok: false, error: "Invalid id." };

  const strength = z.enum(MATCH_STRENGTHS).safeParse(input.matchStrength ?? "plausible");
  if (!strength.success) return { ok: false, error: "Invalid match strength." };
  const priority = z.enum(MATCH_PRIORITIES).safeParse(input.matchPriority ?? "medium");
  if (!priority.success) return { ok: false, error: "Invalid match priority." };
  const role = z.enum(ROLE_SUGGESTIONS).safeParse(input.roleSuggestion ?? "primary");
  if (!role.success) return { ok: false, error: "Invalid role." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const { data: saved } = await supabase
    .from("saved_funding_opportunities")
    .select("opportunity_id")
    .eq("user_id", user.id)
    .eq("opportunity_id", oppId.data)
    .maybeSingle();
  if (!saved) return { ok: false, error: "Save the opportunity first." };

  const { data: maxRow } = await supabase
    .from("saved_opportunity_pi_matches")
    .select("sort_order")
    .eq("user_id", user.id)
    .eq("opportunity_id", oppId.data)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = ((maxRow as { sort_order?: number } | null)?.sort_order ?? -1) + 1;

  const { data: inserted, error } = await supabase
    .from("saved_opportunity_pi_matches")
    .insert({
      user_id: user.id,
      opportunity_id: oppId.data,
      investigator_id: invId.data,
      sort_order: nextOrder,
      match_strength: strength.data,
      match_priority: priority.data,
      rationale: input.rationale?.trim() || null,
      role_suggestion: role.data,
    })
    .select("id")
    .single();

  if (error || !inserted) return { ok: false, error: error?.message ?? "Insert failed." };

  await logActivity(supabase, {
    userId: user.id,
    opportunityId: oppId.data,
    eventType: "pi_added",
    payload: { investigator_id: invId.data, match_id: inserted.id },
    actorId: user.id,
  });

  await supabase
    .from("saved_funding_opportunities")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("opportunity_id", oppId.data);

  revalidatePipeline(oppId.data);
  return { ok: true, id: inserted.id as string };
}

export async function updateSavedOpportunityPiMatchAction(input: {
  matchId: string;
  matchStrength?: string;
  matchPriority?: string;
  rationale?: string | null;
  roleSuggestion?: string;
  outreachStatus?: string;
  notes?: string | null;
  isPrimaryTarget?: boolean;
  followUpDate?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const matchId = uuid.safeParse(input.matchId);
  if (!matchId.success) return { ok: false, error: "Invalid match id." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const { data: row, error: rErr } = await supabase
    .from("saved_opportunity_pi_matches")
    .select("id, opportunity_id, investigator_id, outreach_status, outreach_sent_at")
    .eq("id", matchId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (rErr || !row) return { ok: false, error: "PI match not found." };

  const prevOutreachStatus = String((row as { outreach_status?: string }).outreach_status ?? "");
  const patch: Record<string, unknown> = {};
  if (input.matchStrength !== undefined) {
    const p = z.enum(MATCH_STRENGTHS).safeParse(input.matchStrength);
    if (!p.success) return { ok: false, error: "Invalid match strength." };
    patch.match_strength = p.data;
  }
  if (input.matchPriority !== undefined) {
    const p = z.enum(MATCH_PRIORITIES).safeParse(input.matchPriority);
    if (!p.success) return { ok: false, error: "Invalid match priority." };
    patch.match_priority = p.data;
  }
  if (input.rationale !== undefined) patch.rationale = input.rationale;
  if (input.roleSuggestion !== undefined) {
    const p = z.enum(ROLE_SUGGESTIONS).safeParse(input.roleSuggestion);
    if (!p.success) return { ok: false, error: "Invalid role." };
    patch.role_suggestion = p.data;
  }
  if (input.outreachStatus !== undefined) {
    const p = z.enum(OUTREACH_STATUSES).safeParse(input.outreachStatus);
    if (!p.success) return { ok: false, error: "Invalid outreach status." };
    patch.outreach_status = p.data;
    /** Only stamp send time when outreach is first logged as sent (preserves SLA clock on response updates). */
    if (p.data === "sent" && prevOutreachStatus !== "sent") {
      patch.outreach_sent_at = new Date().toISOString();
    }
  }
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.isPrimaryTarget === true) {
    patch.is_primary_target = true;
  } else if (input.isPrimaryTarget === false) {
    patch.is_primary_target = false;
  }
  if (input.followUpDate !== undefined) {
    patch.follow_up_date = input.followUpDate === "" ? null : input.followUpDate;
  }

  if (input.isPrimaryTarget === true) {
    await supabase
      .from("saved_opportunity_pi_matches")
      .update({ is_primary_target: false })
      .eq("user_id", user.id)
      .eq("opportunity_id", (row as { opportunity_id: string }).opportunity_id);
  }

  if (Object.keys(patch).length === 0) return { ok: true };

  const { error: upErr } = await supabase
    .from("saved_opportunity_pi_matches")
    .update(patch)
    .eq("id", matchId.data)
    .eq("user_id", user.id);

  if (upErr) return { ok: false, error: upErr.message };

  await logActivity(supabase, {
    userId: user.id,
    opportunityId: (row as { opportunity_id: string }).opportunity_id,
    eventType: "pi_updated",
    payload: { match_id: matchId.data, patch },
    actorId: user.id,
  });

  await recalcOutreachAggregates(supabase, user.id, (row as { opportunity_id: string }).opportunity_id);

  revalidatePipeline((row as { opportunity_id: string }).opportunity_id);
  return { ok: true };
}

export async function removeSavedOpportunityPiMatchAction(matchId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = uuid.safeParse(matchId);
  if (!id.success) return { ok: false, error: "Invalid match id." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const { data: row } = await supabase
    .from("saved_opportunity_pi_matches")
    .select("opportunity_id, investigator_id")
    .eq("id", id.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row) return { ok: false, error: "Not found." };

  const { error } = await supabase.from("saved_opportunity_pi_matches").delete().eq("id", id.data).eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  await logActivity(supabase, {
    userId: user.id,
    opportunityId: (row as { opportunity_id: string }).opportunity_id,
    eventType: "pi_removed",
    payload: { investigator_id: (row as { investigator_id: string }).investigator_id },
    actorId: user.id,
  });

  await recalcOutreachAggregates(supabase, user.id, (row as { opportunity_id: string }).opportunity_id);

  revalidatePipeline((row as { opportunity_id: string }).opportunity_id);
  return { ok: true };
}

export async function reorderSavedOpportunityPiMatchesAction(input: {
  opportunityId: string;
  orderedMatchIds: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const oppId = uuid.safeParse(input.opportunityId);
  if (!oppId.success) return { ok: false, error: "Invalid opportunity." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  let order = 0;
  for (const mid of input.orderedMatchIds) {
    const p = uuid.safeParse(mid);
    if (!p.success) continue;
    await supabase
      .from("saved_opportunity_pi_matches")
      .update({ sort_order: order })
      .eq("id", p.data)
      .eq("user_id", user.id)
      .eq("opportunity_id", oppId.data);
    order += 1;
  }

  revalidatePipeline(oppId.data);
  return { ok: true };
}

const emailModeSchema = z.enum(EMAIL_DRAFT_MODES);

export async function logOutreachSentAction(input: {
  opportunityId: string;
  investigatorId: string;
  mode: EmailDraftMode;
  bodyPreview?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const oppId = uuid.safeParse(input.opportunityId);
  const invId = uuid.safeParse(input.investigatorId);
  const mode = emailModeSchema.safeParse(input.mode);
  if (!oppId.success || !invId.success || !mode.success) return { ok: false, error: "Invalid input." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const { data: match } = await supabase
    .from("saved_opportunity_pi_matches")
    .select("id")
    .eq("user_id", user.id)
    .eq("opportunity_id", oppId.data)
    .eq("investigator_id", invId.data)
    .maybeSingle();

  if (!match) return { ok: false, error: "Add the PI to this opportunity first." };

  const { error: upErr } = await supabase
    .from("saved_opportunity_pi_matches")
    .update({
      outreach_status: "sent",
      outreach_sent_at: new Date().toISOString(),
    })
    .eq("id", (match as { id: string }).id)
    .eq("user_id", user.id);

  if (upErr) return { ok: false, error: upErr.message };

  await logActivity(supabase, {
    userId: user.id,
    opportunityId: oppId.data,
    eventType: "outreach_sent",
    payload: {
      investigator_id: invId.data,
      mode: mode.data,
      preview: (input.bodyPreview ?? "").slice(0, 500),
    },
    actorId: user.id,
  });

  await recalcOutreachAggregates(supabase, user.id, oppId.data);

  revalidatePipeline(oppId.data);
  return { ok: true };
}

const pendingOutreachForSend = new Set(["not_contacted", "drafted"]);

type PiMatchSendRow = {
  id: string;
  investigator_id: string;
  rationale: string | null;
  notes: string | null;
  outreach_status: string;
  investigators:
    | { id: string; full_name: string | null; email: string | null }
    | { id: string; full_name: string | null; email: string | null }[]
    | null;
};

function investigatorOne(
  inv: PiMatchSendRow["investigators"]
): { full_name: string | null; email: string | null } | null {
  if (!inv) return null;
  return !Array.isArray(inv) ? inv : inv[0] ?? null;
}

function piDisplayName(m: PiMatchSendRow): string {
  return investigatorOne(m.investigators)?.full_name?.trim() || "Investigator";
}

function piEmail(m: PiMatchSendRow): string | null {
  const e = investigatorOne(m.investigators)?.email?.trim();
  return e || null;
}

/** Send exploratory-style outreach via Resend to each PI still awaiting send, then move the save to Monitor. */
export async function sendPipelineOutreachEmailsAndMoveToMonitorAction(input: {
  opportunityId: string;
  mode?: string;
}): Promise<{ ok: true; sent: number; alreadyLogged?: boolean } | { ok: false; error: string }> {
  const oppId = uuid.safeParse(input.opportunityId);
  if (!oppId.success) return { ok: false, error: "Invalid opportunity." };

  const modeParsed = emailModeSchema.safeParse(input.mode ?? "exploratory");
  if (!modeParsed.success) return { ok: false, error: "Invalid email mode." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const { data: profile } = await supabase.from("profiles").select("email").eq("id", user.id).maybeSingle();
  const replyTo =
    ((profile as { email?: string | null } | null)?.email ?? user.email ?? "").trim() || null;

  const { data: saved, error: sErr } = await supabase
    .from("saved_funding_opportunities")
    .select("stage, why_matters, internal_notes, funding_opportunities ( title, agency, close_date, funding_instrument )")
    .eq("user_id", user.id)
    .eq("opportunity_id", oppId.data)
    .maybeSingle();

  if (sErr || !saved) return { ok: false, error: "Saved opportunity not found." };

  const stage = String((saved as { stage?: string }).stage ?? "");
  if (stage !== "triage") {
    return { ok: false, error: "Send emails is only available while the opportunity is in Triage." };
  }

  const { data: commRows, error: commErr } = await supabase
    .from("saved_funding_opportunity_communities")
    .select("community_id")
    .eq("user_id", user.id)
    .eq("opportunity_id", oppId.data)
    .limit(1);

  if (commErr) return { ok: false, error: commErr.message };
  if (!commRows?.length) {
    return {
      ok: false,
      error:
        "Tag at least one research community on this notice before sending emails. Uncategorized saves can use Move to Monitor without sending.",
    };
  }

  const whyMatters = String((saved as { why_matters?: string | null }).why_matters ?? "");
  const internalNotes = String((saved as { internal_notes?: string | null }).internal_notes ?? "");
  const foRaw = (saved as { funding_opportunities?: unknown }).funding_opportunities;
  const fo = (Array.isArray(foRaw) ? foRaw[0] : foRaw) as {
    title?: string | null;
    agency?: string | null;
    close_date?: string | null;
    funding_instrument?: string | null;
  } | null;

  const agency = coercePlainTextFromUnknown(fo?.agency);
  const mech = coercePlainTextFromUnknown(fo?.funding_instrument);
  const sponsorLine = agency && mech ? `${agency} · ${mech}` : agency || mech || "—";
  const opportunityTitle = (fo?.title ?? "").trim() || "Funding opportunity";
  const deadlineLine = formatDate(fo?.close_date ?? null);

  const { data: matches, error: mErr } = await supabase
    .from("saved_opportunity_pi_matches")
    .select(
      "id, investigator_id, rationale, notes, outreach_status, investigators ( id, full_name, email, home_department, division )"
    )
    .eq("user_id", user.id)
    .eq("opportunity_id", oppId.data)
    .order("sort_order", { ascending: true });

  if (mErr) return { ok: false, error: mErr.message };

  const list = (matches ?? []) as PiMatchSendRow[];
  if (list.length === 0) {
    return { ok: false, error: "Add at least one matched PI before sending." };
  }

  const pending = list.filter((row) => pendingOutreachForSend.has(String(row.outreach_status)));

  if (pending.length === 0) {
    const moved = await updateSavedOpportunityPipelineAction({ opportunityId: oppId.data, stage: "monitor" });
    if (!moved.ok) return { ok: false, error: moved.error };
    return { ok: true, sent: 0, alreadyLogged: true };
  }

  const missingEmail = pending.filter((m) => !piEmail(m)).map((m) => piDisplayName(m));
  if (missingEmail.length > 0) {
    return {
      ok: false,
      error: `Add email addresses for these investigators before sending: ${missingEmail.join(", ")}.`,
    };
  }

  const subjectBase = `Funding opportunity: ${opportunityTitle.slice(0, 72)}${opportunityTitle.length > 72 ? "…" : ""}`;

  let sent = 0;
  for (const m of pending) {
    const to = piEmail(m)!;
    const piName = piDisplayName(m);
    const rationale =
      [m.rationale, m.notes].filter(Boolean).join(" ").trim() || whyMatters || internalNotes;
    const textBody = buildOutreachEmailDraft(modeParsed.data, {
      piName,
      piEmail: to,
      opportunityTitle,
      sponsorOrMechanism: sponsorLine,
      deadlineLine,
      fitRationale: rationale || "We see conceptual alignment worth a brief scan.",
    });

    const send = await sendTransactionalTextEmail({
      to,
      subject: subjectBase,
      text: textBody,
      replyTo,
    });
    if (!send.ok) return { ok: false, error: send.error };

    const { error: upErr } = await supabase
      .from("saved_opportunity_pi_matches")
      .update({
        outreach_status: "sent",
        outreach_sent_at: new Date().toISOString(),
      })
      .eq("id", m.id)
      .eq("user_id", user.id);

    if (upErr) return { ok: false, error: upErr.message };

    await logActivity(supabase, {
      userId: user.id,
      opportunityId: oppId.data,
      eventType: "outreach_sent",
      payload: {
        investigator_id: m.investigator_id,
        mode: modeParsed.data,
        preview: textBody.slice(0, 500),
        channel: "resend",
      },
      actorId: user.id,
    });
    sent += 1;
  }

  await recalcOutreachAggregates(supabase, user.id, oppId.data);

  const moved = await updateSavedOpportunityPipelineAction({ opportunityId: oppId.data, stage: "monitor" });
  if (!moved.ok) return { ok: false, error: moved.error };

  return { ok: true, sent, alreadyLogged: false };
}

export async function setSavedOpportunityCommunitiesAction(input: {
  opportunityId: string;
  communityIds: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const oppId = uuid.safeParse(input.opportunityId);
  if (!oppId.success) return { ok: false, error: "Invalid opportunity." };

  const uniqueIds: string[] = [];
  for (const id of input.communityIds) {
    const p = uuid.safeParse(id);
    if (p.success) uniqueIds.push(p.data);
  }
  const unique = Array.from(new Set(uniqueIds));

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const { data: saved } = await supabase
    .from("saved_funding_opportunities")
    .select("opportunity_id")
    .eq("user_id", user.id)
    .eq("opportunity_id", oppId.data)
    .maybeSingle();
  if (!saved) return { ok: false, error: "Saved opportunity not found." };

  const { error: delErr } = await supabase
    .from("saved_funding_opportunity_communities")
    .delete()
    .eq("user_id", user.id)
    .eq("opportunity_id", oppId.data);
  if (delErr) return { ok: false, error: delErr.message };

  if (unique.length > 0) {
    const { error: insErr } = await supabase.from("saved_funding_opportunity_communities").insert(
      unique.map((community_id) => ({
        user_id: user.id,
        opportunity_id: oppId.data,
        community_id,
      }))
    );
    if (insErr) return { ok: false, error: insErr.message };
  }

  await logActivity(supabase, {
    userId: user.id,
    opportunityId: oppId.data,
    eventType: "communities_updated",
    payload: { community_ids: unique },
    actorId: user.id,
  });

  await supabase
    .from("saved_funding_opportunities")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("opportunity_id", oppId.data);

  revalidatePipeline(oppId.data);
  return { ok: true };
}

export async function moveOpportunityToColdAction(input: {
  opportunityId: string;
  coldUntil?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const oppId = uuid.safeParse(input.opportunityId);
  if (!oppId.success) return { ok: false, error: "Invalid opportunity." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const { data: row } = await supabase
    .from("saved_funding_opportunities")
    .select("opportunity_id, funding_opportunities(close_date)")
    .eq("user_id", user.id)
    .eq("opportunity_id", oppId.data)
    .maybeSingle();

  if (!row) return { ok: false, error: "Not found." };

  const fo = (row as { funding_opportunities?: { close_date?: string | null } | { close_date?: string | null }[] | null })
    .funding_opportunities;
  const single = fo && !Array.isArray(fo) ? fo : Array.isArray(fo) ? fo[0] : null;
  const closeDate = single?.close_date ?? null;

  let until: string;
  if (input.coldUntil && input.coldUntil.trim()) {
    until = input.coldUntil.trim().slice(0, 10);
  } else {
    until = computeDefaultColdUntil(closeDate);
  }

  const { error } = await supabase
    .from("saved_funding_opportunities")
    .update({
      stage: "cold",
      cold_until: until,
      last_activity_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("opportunity_id", oppId.data);

  if (error) return { ok: false, error: error.message };

  await logActivity(supabase, {
    userId: user.id,
    opportunityId: oppId.data,
    eventType: "stage_change",
    payload: { to: "cold", cold_until: until },
    actorId: user.id,
  });

  revalidatePipeline(oppId.data);
  return { ok: true };
}

export async function expireStaleColdOpportunitiesAction(): Promise<
  { ok: true; archived: number } | { ok: false; error: string }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const today = new Date().toISOString().slice(0, 10);
  const { data: stale, error: qErr } = await supabase
    .from("saved_funding_opportunities")
    .select("opportunity_id")
    .eq("user_id", user.id)
    .eq("stage", "cold")
    .not("cold_until", "is", null)
    .lt("cold_until", today);

  if (qErr) return { ok: false, error: qErr.message };

  let n = 0;
  const now = new Date().toISOString();
  for (const r of stale ?? []) {
    const oid = (r as { opportunity_id: string }).opportunity_id;
    const { error: uErr } = await supabase
      .from("saved_funding_opportunities")
      .update({
        stage: "archived",
        archived_at: now,
        last_activity_at: now,
      })
      .eq("user_id", user.id)
      .eq("opportunity_id", oid);
    if (!uErr) {
      n += 1;
      await logActivity(supabase, {
        userId: user.id,
        opportunityId: oid,
        eventType: "stage_change",
        payload: { from: "cold", to: "archived", reason: "cold_expired" },
        actorId: user.id,
      });
      revalidatePipeline(oid);
    }
  }

  revalidatePath("/match/saved");
  return { ok: true, archived: n };
}

function daysSinceOutreachSent(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

/** After outreach is logged as sent, re-notify is allowed 7+ days later; 14+ days with no interested response moves the opportunity to Cold. */
export async function resendMonitorOutreachReminderAction(
  matchId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = uuid.safeParse(matchId);
  if (!id.success) return { ok: false, error: "Invalid match id." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const { data: m, error: mErr } = await supabase
    .from("saved_opportunity_pi_matches")
    .select("id, opportunity_id, outreach_status, outreach_sent_at")
    .eq("id", id.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (mErr || !m) return { ok: false, error: "PI match not found." };
  if (String(m.outreach_status) !== "sent") {
    return { ok: false, error: "Re-send applies only while awaiting a response (sent, no reply logged yet)." };
  }
  const days = daysSinceOutreachSent((m as { outreach_sent_at?: string | null }).outreach_sent_at ?? null);
  if (days === null || days < 7) {
    return { ok: false, error: "Re-send is available starting 7 days after the last outreach timestamp." };
  }

  const now = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("saved_opportunity_pi_matches")
    .update({ outreach_sent_at: now, updated_at: now })
    .eq("id", id.data)
    .eq("user_id", user.id);

  if (upErr) return { ok: false, error: upErr.message };

  await logActivity(supabase, {
    userId: user.id,
    opportunityId: (m as { opportunity_id: string }).opportunity_id,
    eventType: "pi_updated",
    payload: { match_id: id.data, monitor_outreach_resend: true },
    actorId: user.id,
  });

  await recalcOutreachAggregates(supabase, user.id, (m as { opportunity_id: string }).opportunity_id);
  revalidatePipeline((m as { opportunity_id: string }).opportunity_id);
  return { ok: true };
}

/** Auto-move Monitor opportunities to Cold when a sent outreach is 14+ days old and no PI is marked interested. */
export async function expireMonitorAwaitingToColdAction(): Promise<
  { ok: true; moved: number } | { ok: false; error: string }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const { data: opps, error: qErr } = await supabase
    .from("saved_funding_opportunities")
    .select("opportunity_id")
    .eq("user_id", user.id)
    .eq("stage", "monitor");

  if (qErr) return { ok: false, error: qErr.message };

  const coldThresholdMs = 14 * 86400000;
  let moved = 0;

  for (const r of opps ?? []) {
    const oid = (r as { opportunity_id: string }).opportunity_id;
    const { data: matches } = await supabase
      .from("saved_opportunity_pi_matches")
      .select("outreach_status, outreach_sent_at")
      .eq("user_id", user.id)
      .eq("opportunity_id", oid);

    if (!matches?.length) continue;
    if (matches.some((row) => String(row.outreach_status) === "responded_interested")) continue;

    const hasStaleSent = matches.some((row) => {
      if (String(row.outreach_status) !== "sent") return false;
      const sentAt = (row as { outreach_sent_at?: string | null }).outreach_sent_at;
      if (!sentAt) return false;
      return Date.now() - new Date(sentAt).getTime() >= coldThresholdMs;
    });

    if (!hasStaleSent) continue;

    const r2 = await moveOpportunityToColdAction({ opportunityId: oid });
    if (r2.ok) moved += 1;
  }

  if (moved > 0) revalidatePath("/match/saved");
  return { ok: true, moved };
}
