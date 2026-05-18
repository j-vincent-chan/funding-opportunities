"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  formatBulkRefreshSummary,
  refreshAllInvestigatorsCommunityCaches,
} from "@/lib/community/bulk-refresh-investigator-caches";
import { recomputeCoauthorshipFromPublications } from "@/lib/community/collaborations";
import { refreshInvestigatorPubMed } from "@/lib/community/pubmed-ingest";
import { refreshInvestigatorReporter } from "@/lib/community/reporter-ingest";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin-service";

const engagementStatusSchema = z.enum([
  "identified",
  "matched",
  "contacted",
  "engaged",
  "drafting",
  "internal_review",
  "submitted",
  "funded",
  "declined",
  "dormant",
]);

const createEngagementSchema = z.object({
  investigatorId: z.string().uuid(),
  engagementType: z.string().trim().min(1).max(120).optional(),
  status: engagementStatusSchema.optional(),
  opportunityId: z.string().uuid().optional().nullable(),
  notes: z.string().max(20_000).optional().nullable(),
  nextStep: z.string().max(10_000).optional().nullable(),
  nextStepDueDate: z.string().optional().nullable(),
});

export async function createStrategistEngagementFormAction(formData: FormData): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const rawOpp = formData.get("opportunityId");
  const oppTrim =
    rawOpp && String(rawOpp).trim() ? String(rawOpp).trim() : null;
  const opportunityId =
    oppTrim && z.string().uuid().safeParse(oppTrim).success ? oppTrim : null;

  const parsed = createEngagementSchema.safeParse({
    investigatorId: formData.get("investigatorId"),
    engagementType: formData.get("engagementType") || "outreach",
    status: formData.get("status") || "identified",
    opportunityId,
    notes: formData.get("notes") || null,
    nextStep: formData.get("nextStep") || null,
    nextStepDueDate: formData.get("nextStepDueDate") || null,
  });
  if (!parsed.success) {
    throw new Error("Invalid engagement form");
  }

  const { error } = await supabase.from("strategist_engagements").insert({
    investigator_id: parsed.data.investigatorId,
    owner_user_id: user.id,
    engagement_type: parsed.data.engagementType ?? "outreach",
    status: parsed.data.status ?? "identified",
    opportunity_id: parsed.data.opportunityId ?? null,
    notes: parsed.data.notes ?? null,
    next_step: parsed.data.nextStep ?? null,
    next_step_due_date: parsed.data.nextStepDueDate?.trim()
      ? parsed.data.nextStepDueDate
      : null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/pi-community");
  revalidatePath("/pi-community/engagements");
  revalidatePath(`/investigators/${parsed.data.investigatorId}`);
}

const updateEngagementSchema = z.object({
  engagementId: z.string().uuid(),
  status: engagementStatusSchema,
  lastContactDate: z.string().optional().nullable(),
  nextStep: z.string().max(10_000).optional().nullable(),
  nextStepDueDate: z.string().optional().nullable(),
  notes: z.string().max(20_000).optional().nullable(),
  outcome: z.string().max(10_000).optional().nullable(),
});

export async function updateStrategistEngagementFormAction(formData: FormData): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const parsed = updateEngagementSchema.safeParse({
    engagementId: formData.get("engagementId"),
    status: formData.get("status"),
    lastContactDate: formData.get("lastContactDate") || null,
    nextStep: formData.get("nextStep") || null,
    nextStepDueDate: formData.get("nextStepDueDate") || null,
    notes: formData.get("notes") || null,
    outcome: formData.get("outcome") || null,
  });
  if (!parsed.success) throw new Error("Invalid update");

  const { data: existing } = await supabase
    .from("strategist_engagements")
    .select("investigator_id")
    .eq("id", parsed.data.engagementId)
    .maybeSingle();

  const { error } = await supabase
    .from("strategist_engagements")
    .update({
      status: parsed.data.status,
      last_contact_date: parsed.data.lastContactDate?.trim() || null,
      next_step: parsed.data.nextStep ?? null,
      next_step_due_date: parsed.data.nextStepDueDate?.trim() || null,
      notes: parsed.data.notes ?? null,
      outcome: parsed.data.outcome ?? null,
    })
    .eq("id", parsed.data.engagementId);

  if (error) throw new Error(error.message);
  revalidatePath("/pi-community");
  revalidatePath("/pi-community/engagements");
  revalidatePath(`/pi-community/engagements/${parsed.data.engagementId}`);
  if (existing?.investigator_id) {
    revalidatePath(`/investigators/${existing.investigator_id}`);
  }
}

export async function refreshInvestigatorPubMedFormAction(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("investigatorId"));
  if (!id.success) throw new Error("Invalid investigator");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  try {
    await refreshInvestigatorPubMed(supabase, id.data);
    await recomputeCoauthorshipFromPublications(supabase);
    revalidatePath("/pi-community");
    revalidatePath(`/investigators/${id.data}`);
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : String(e));
  }
}

export async function refreshInvestigatorReporterFormAction(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("investigatorId"));
  if (!id.success) throw new Error("Invalid investigator");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  try {
    const result = await refreshInvestigatorReporter(supabase, id.data);
    revalidatePath("/pi-community");
    revalidatePath(`/investigators/${id.data}`);
    if (result.skipped === "missing_nih_profile_id" && result.warning) {
      throw new Error(result.warning);
    }
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : String(e));
  }
}

export async function recomputeCommunityCollaborationsFormAction(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  try {
    await recomputeCoauthorshipFromPublications(supabase);
    revalidatePath("/pi-community");
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : String(e));
  }
}

/**
 * Admin-only: refresh PubMed + RePORTER for every investigator, then recompute co-authorship.
 * May hit serverless time limits with very large directories; use `npm run refresh-investigator-caches`
 * or POST /api/cron/refresh-investigator-caches in that case.
 */
export async function refreshAllInvestigatorCachesAdminAction(): Promise<{
  ok: boolean;
  message: string;
}> {
  const supabase = createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) {
    return { ok: false, message: admin.error };
  }
  const sr = createServiceRoleClient() ?? supabase;
  try {
    const result = await refreshAllInvestigatorsCommunityCaches(sr);
    revalidatePath("/pi-community");
    revalidatePath("/investigators");
    return { ok: true, message: formatBulkRefreshSummary(result) };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
