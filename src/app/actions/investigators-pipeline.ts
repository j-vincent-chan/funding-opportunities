"use server";

import { revalidatePath } from "next/cache";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/server";
import { buildInvestigatorFeatureRow } from "@/lib/investigators/normalize-investigator-features";
import {
  parseAffiliationsJson,
  rowToInvestigatorCsv,
} from "@/lib/csv/investigator-csv";
import { requireAdmin } from "@/lib/auth/require-admin";
import { z } from "zod";

function fullName(first: string, last: string): string {
  return `${first.trim()} ${last.trim()}`.trim();
}

export async function importInvestigatorsFromCsv(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { error: "Missing file" };
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  let ok = 0;
  const errors: string[] = [];

  for (let i = 0; i < parsed.data.length; i += 1) {
    const line = i + 2;
    const rec = parsed.data[i];
    const row = rowToInvestigatorCsv(rec, line);
    if (!row.ok) {
      errors.push(`Line ${line}: ${row.error}`);
      continue;
    }
    const d = row.data;
    const affiliations = parseAffiliationsJson(d.affiliations);

    const raw_profile_json = {
      ...d,
      affiliations_raw: d.affiliations,
    };

    const invRow = {
      first_name: d.first_name,
      last_name: d.last_name,
      full_name: fullName(d.first_name, d.last_name),
      email: d.email || null,
      home_department: d.home_department || null,
      division: d.division || null,
      rank: d.rank || null,
      affiliations,
      nih_profile_id: d.nih_profile_id || null,
      raw_profile_json,
    };

    let invId: string;
    if (d.email) {
      const { data: existing } = await supabase
        .from("investigators")
        .select("id")
        .ilike("email", d.email.trim())
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from("investigators")
          .update(invRow)
          .eq("id", existing.id);
        if (error) {
          errors.push(`Line ${line}: ${error.message}`);
          continue;
        }
        invId = existing.id;
      } else {
        const { data: inserted, error } = await supabase
          .from("investigators")
          .insert(invRow)
          .select("id")
          .single();
        if (error || !inserted) {
          errors.push(`Line ${line}: ${error?.message ?? "insert failed"}`);
          continue;
        }
        invId = inserted.id;
      }
    } else {
      const { data: inserted, error } = await supabase
        .from("investigators")
        .insert(invRow)
        .select("id")
        .single();
      if (error || !inserted) {
        errors.push(`Line ${line}: ${error?.message ?? "insert failed"}`);
        continue;
      }
      invId = inserted.id;
    }

    const feats = buildInvestigatorFeatureRow({
      primary_research_area: d.primary_research_area,
      secondary_research_areas: d.secondary_research_areas,
      primary_disease_focus: d.primary_disease_focus,
      secondary_disease_focuses: d.secondary_disease_focuses,
      technological_expertise: d.technological_expertise,
      clinical_samples: d.clinical_samples,
      biobanks: d.biobanks,
      small_grants: d.small_grants,
      large_grants: d.large_grants,
      affiliations: d.affiliations,
      research_summary: d.research_summary,
      division: d.division,
      rank: d.rank,
    });

    const { error: fErr } = await supabase.from("investigator_profile_features").upsert(
      {
        investigator_id: invId,
        ...feats,
      },
      { onConflict: "investigator_id" }
    );
    if (fErr) {
      errors.push(`Line ${line} features: ${fErr.message}`);
      continue;
    }
    ok += 1;
  }

  revalidatePath("/investigators");
  return { ok: true as const, imported: ok, errors };
}

export async function normalizeInvestigatorProfilesForm(formData: FormData): Promise<void> {
  void formData;
  await normalizeInvestigatorProfiles();
}

export async function normalizeInvestigatorProfiles() {
  const supabase = createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return { error: admin.error };

  const { data: invs, error } = await supabase.from("investigators").select("*");
  if (error) return { error: error.message };

  let n = 0;
  const errors: string[] = [];
  for (const inv of invs ?? []) {
    const raw = (inv.raw_profile_json ?? {}) as Record<string, string>;
    const feats = buildInvestigatorFeatureRow({
      primary_research_area: raw.primary_research_area,
      secondary_research_areas: raw.secondary_research_areas,
      primary_disease_focus: raw.primary_disease_focus,
      secondary_disease_focuses: raw.secondary_disease_focuses,
      technological_expertise: raw.technological_expertise,
      clinical_samples: raw.clinical_samples,
      biobanks: raw.biobanks,
      small_grants: raw.small_grants,
      large_grants: raw.large_grants,
      affiliations: raw.affiliations ?? raw.affiliations_raw,
      research_summary: raw.research_summary,
      division: inv.division,
      rank: inv.rank,
    });
    const { error: uErr } = await supabase.from("investigator_profile_features").upsert(
      {
        investigator_id: inv.id,
        ...feats,
      },
      { onConflict: "investigator_id" }
    );
    if (uErr) errors.push(`${inv.id}: ${uErr.message}`);
    else n += 1;
  }

  revalidatePath("/investigators");
  return { ok: true as const, normalized: n, errors };
}

export async function normalizeSingleInvestigatorForm(formData: FormData): Promise<void> {
  const id = formData.get("investigatorId");
  if (typeof id !== "string" || !id) return;
  await normalizeSingleInvestigator(id);
}

/**
 * Set or clear `investigators.nih_profile_id` (NIH RePORTER PI profile id, numeric).
 * Empty input clears the field; NIH RePORTER refresh will not load projects until an id is saved again.
 */
export async function updateInvestigatorNihProfileIdFormAction(
  formData: FormData
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const invParsed = z.string().uuid().safeParse(formData.get("investigatorId"));
  if (!invParsed.success) throw new Error("Invalid investigator");

  const raw = formData.get("nihProfileId");
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  let nih_profile_id: string | null = null;
  if (trimmed) {
    const digits = trimmed.replace(/\D/g, "");
    if (!digits) {
      throw new Error("NIH Reporter profile id must contain at least one digit");
    }
    nih_profile_id = digits;
  }

  const { error } = await supabase
    .from("investigators")
    .update({ nih_profile_id })
    .eq("id", invParsed.data);

  if (error) throw new Error(error.message);
  revalidatePath("/investigators");
  revalidatePath(`/investigators/${invParsed.data}`);
}

export async function updateInvestigatorResearchCommunityAction(formData: FormData): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const invParsed = z.string().uuid().safeParse(formData.get("investigatorId"));
  if (!invParsed.success) throw new Error("Invalid investigator");

  const raw = formData.get("researchCommunityId");
  const rawStr = typeof raw === "string" ? raw.trim() : "";
  let research_community_id: string | null = null;
  if (rawStr) {
    const cid = z.string().uuid().safeParse(rawStr);
    if (!cid.success) throw new Error("Invalid research community");
    research_community_id = cid.data;
  }

  const { error } = await supabase
    .from("investigators")
    .update({ research_community_id })
    .eq("id", invParsed.data);

  if (error) throw new Error(error.message);
  revalidatePath("/investigators");
  revalidatePath(`/investigators/${invParsed.data}`);
}

export async function normalizeSingleInvestigator(investigatorId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: inv, error } = await supabase
    .from("investigators")
    .select("*")
    .eq("id", investigatorId)
    .maybeSingle();
  if (error || !inv) return { error: error?.message ?? "Not found" };

  const raw = (inv.raw_profile_json ?? {}) as Record<string, string>;
  const feats = buildInvestigatorFeatureRow({
    primary_research_area: raw.primary_research_area,
    secondary_research_areas: raw.secondary_research_areas,
    primary_disease_focus: raw.primary_disease_focus,
    secondary_disease_focuses: raw.secondary_disease_focuses,
    technological_expertise: raw.technological_expertise,
    clinical_samples: raw.clinical_samples,
    biobanks: raw.biobanks,
    small_grants: raw.small_grants,
    large_grants: raw.large_grants,
    affiliations: raw.affiliations ?? raw.affiliations_raw,
    research_summary: raw.research_summary,
    division: inv.division,
    rank: inv.rank,
  });

  const { error: uErr } = await supabase.from("investigator_profile_features").upsert(
    {
      investigator_id: inv.id,
      ...feats,
    },
    { onConflict: "investigator_id" }
  );
  if (uErr) return { error: uErr.message };

  revalidatePath("/investigators");
  revalidatePath(`/investigators/${investigatorId}`);
  return { ok: true as const };
}
