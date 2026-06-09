"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  loadFundingOpportunityPeek,
  type FundingOpportunityPeekData,
} from "@/lib/funding-opportunities/funding-opportunity-peek";
import {
  fundingListStateForBookmark,
  parseSavedFundingListState,
} from "@/lib/funding-opportunities/saved-funding-list-state";

const nameSchema = z.string().trim().min(1, "Name is required").max(120, "Name is too long");
const alertFrequencySchema = z.enum(["instant", "daily", "weekly"]);
const savedSearchIdSchema = z.string().uuid();

export async function saveFundingSearchAction(input: {
  name: string;
  state: unknown;
  emailNotificationsEnabled?: boolean;
  alertFrequency?: "instant" | "daily" | "weekly";
  alertForecastedNotices?: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to save a search." };

  const nameParsed = nameSchema.safeParse(input.name);
  if (!nameParsed.success) {
    return { ok: false, error: nameParsed.error.issues[0]?.message ?? "Invalid name" };
  }

  const state = parseSavedFundingListState(input.state);
  if (!state) return { ok: false, error: "Invalid search state." };

  const notify = Boolean(input.emailNotificationsEnabled);
  const frequencyParsed = alertFrequencySchema.safeParse(input.alertFrequency ?? "weekly");
  const alertFrequency = frequencyParsed.success ? frequencyParsed.data : "weekly";

  const { data, error } = await supabase
    .from("saved_funding_searches")
    .insert({
      user_id: user.id,
      name: nameParsed.data,
      state: fundingListStateForBookmark(state),
      email_notifications_enabled: notify,
      alert_frequency: alertFrequency,
      alert_forecasted_notices: input.alertForecastedNotices !== false,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Could not save search." };
  revalidatePath("/funding-opportunities");
  return { ok: true, id: data.id as string };
}

export async function deleteSavedFundingSearchAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid id." };
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { error } = await supabase.from("saved_funding_searches").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/funding-opportunities");
  return { ok: true };
}

export async function loadFundingOpportunityPeekAction(
  opportunityId: string
): Promise<{ ok: true; data: FundingOpportunityPeekData } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(opportunityId).success) {
    return { ok: false, error: "Invalid opportunity id." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const data = await loadFundingOpportunityPeek(supabase, opportunityId, user?.id ?? null);
  if (!data) return { ok: false, error: "Opportunity not found." };
  return { ok: true, data };
}

export async function dismissFundingOpportunityAction(
  opportunityId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(opportunityId).success) {
    return { ok: false, error: "Invalid opportunity id." };
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to dismiss opportunities." };

  const { data: existing } = await supabase
    .from("dismissed_funding_opportunities")
    .select("opportunity_id")
    .eq("user_id", user.id)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("dismissed_funding_opportunities").insert({
      user_id: user.id,
      opportunity_id: opportunityId,
    });
    if (error) return { ok: false, error: error.message };
  }

  await supabase
    .from("saved_funding_opportunities")
    .delete()
    .eq("user_id", user.id)
    .eq("opportunity_id", opportunityId);

  revalidatePath("/funding-opportunities");
  revalidatePath(`/funding-opportunities/${opportunityId}`);
  revalidatePath("/match/saved");
  revalidatePath(`/match/saved/${opportunityId}`);
  return { ok: true };
}

export async function toggleSavedFundingOpportunityAction(
  opportunityId: string
): Promise<{ ok: true; saved: boolean } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(opportunityId).success) {
    return { ok: false, error: "Invalid opportunity id." };
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to save opportunities." };

  const { data: existing, error: selErr } = await supabase
    .from("saved_funding_opportunities")
    .select("opportunity_id")
    .eq("user_id", user.id)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();

  if (selErr) return { ok: false, error: selErr.message };

  if (existing) {
    const { error } = await supabase
      .from("saved_funding_opportunities")
      .delete()
      .eq("user_id", user.id)
      .eq("opportunity_id", opportunityId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/funding-opportunities");
    revalidatePath(`/funding-opportunities/${opportunityId}`);
    revalidatePath("/match/saved");
    revalidatePath(`/match/saved/${opportunityId}`);
    return { ok: true, saved: false };
  }

  const { error } = await supabase.from("saved_funding_opportunities").insert({
    user_id: user.id,
    opportunity_id: opportunityId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/funding-opportunities");
  revalidatePath(`/funding-opportunities/${opportunityId}`);
  revalidatePath("/match/saved");
  revalidatePath(`/match/saved/${opportunityId}`);
  return { ok: true, saved: true };
}

export async function setSavedFundingSearchEmailNotificationsAction(input: {
  savedSearchId: string;
  enabled: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return updateSavedFundingSearchSettingsAction({
    savedSearchId: input.savedSearchId,
    emailNotificationsEnabled: input.enabled,
  });
}

export async function updateSavedFundingSearchSettingsAction(input: {
  savedSearchId: string;
  emailNotificationsEnabled?: boolean;
  alertFrequency?: "instant" | "daily" | "weekly";
  alertForecastedNotices?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const idParsed = savedSearchIdSchema.safeParse(input.savedSearchId);
  if (!idParsed.success) return { ok: false, error: "Invalid saved search id." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const patch: Record<string, unknown> = {};
  if (typeof input.emailNotificationsEnabled === "boolean") {
    patch.email_notifications_enabled = input.emailNotificationsEnabled;
  }
  if (input.alertFrequency !== undefined) {
    const frequencyParsed = alertFrequencySchema.safeParse(input.alertFrequency);
    if (!frequencyParsed.success) return { ok: false, error: "Invalid alert frequency." };
    patch.alert_frequency = frequencyParsed.data;
  }
  if (typeof input.alertForecastedNotices === "boolean") {
    patch.alert_forecasted_notices = input.alertForecastedNotices;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "No settings to update." };
  }

  const { error } = await supabase
    .from("saved_funding_searches")
    .update(patch)
    .eq("id", idParsed.data)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/funding-opportunities");
  return { ok: true };
}

export async function markSavedFundingSearchViewedAction(
  savedSearchId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const idParsed = savedSearchIdSchema.safeParse(savedSearchId);
  if (!idParsed.success) return { ok: false, error: "Invalid saved search id." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("saved_funding_searches")
    .update({ last_viewed_at: now })
    .eq("id", idParsed.data)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/funding-opportunities");
  return { ok: true };
}

