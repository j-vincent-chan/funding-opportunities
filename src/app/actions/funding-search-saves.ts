"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  fundingListStateForBookmark,
  parseSavedFundingListState,
} from "@/lib/funding-opportunities/saved-funding-list-state";

const nameSchema = z.string().trim().min(1, "Name is required").max(120, "Name is too long");

export async function saveFundingSearchAction(input: {
  name: string;
  state: unknown;
  emailNotificationsEnabled?: boolean;
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

  const { data, error } = await supabase
    .from("saved_funding_searches")
    .insert({
      user_id: user.id,
      name: nameParsed.data,
      state: fundingListStateForBookmark(state),
      email_notifications_enabled: notify,
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
  if (!z.string().uuid().safeParse(input.savedSearchId).success) {
    return { ok: false, error: "Invalid saved search id." };
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { error } = await supabase
    .from("saved_funding_searches")
    .update({ email_notifications_enabled: input.enabled })
    .eq("id", input.savedSearchId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/funding-opportunities");
  return { ok: true };
}

