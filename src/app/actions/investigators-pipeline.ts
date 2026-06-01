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
import { resolvePubmedInvestigatorName } from "@/lib/community/pubmed-query";
import { resolveSignalHeadshotUrl } from "@/lib/community/signal-headshot-url";
import { z } from "zod";

function fullName(first: string, last: string): string {
  return `${first.trim()} ${last.trim()}`.trim();
}

function maybeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s.length > 0 ? s : null;
}

function digitsOnly(value: unknown): string | null {
  const txt = maybeText(value);
  if (!txt) return null;
  const digits = txt.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

type SignalTrackedEntityImportRow = {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  middle_initial?: string | null;
  name?: string | null;
  slug?: string | null;
  entity_type?: string | null;
  priority_tier?: number | null;
  active?: boolean | null;
  member_status?: string | null;
  institution?: string | null;
  pubmed_url?: string | null;
  lab_website?: string | null;
  google_alert_query?: string | null;
  nih_profile_id?: string | null;
  x_handle?: string | null;
  bluesky_handle?: string | null;
  x_lab_handle?: string | null;
  bluesky_lab_handle?: string | null;
  headshot_url?: string | null;
  headshot_storage_path?: string | null;
  community_id?: string | null;
  email?: string | null;
};

/**
 * Import Signal `tracked_entities` into the local `investigators` directory.
 * Called after client-side OTP auth against the Signal Supabase project.
 */
export async function importInvestigatorsFromSignal(rows: unknown[]) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  if (!Array.isArray(rows) || rows.length === 0) return { error: "No Signal rows provided" };
  if (rows.length > 2000) return { error: "Too many rows in one import (max 2000)." };

  let imported = 0;
  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const raw = rows[i];
    if (!raw || typeof raw !== "object") {
      errors.push(`Row ${i + 1}: invalid payload`);
      continue;
    }

    const r = raw as SignalTrackedEntityImportRow;
    const first = maybeText(r.first_name) ?? "";
    const last = maybeText(r.last_name) ?? "";
    const middleInitial = maybeText(r.middle_initial);
    const displayName = maybeText(r.name) ?? fullName(first, last);
    const resolvedName = resolvePubmedInvestigatorName({
      firstName: first || displayName,
      lastName: last,
      middleInitial,
      fullName: displayName,
    });
    if (!displayName) {
      errors.push(`Row ${i + 1}: missing name`);
      continue;
    }

    const email = maybeText(r.email);
    const nihProfileId = digitsOnly(r.nih_profile_id);
    const institution = maybeText(r.institution);
    const memberStatus = maybeText(r.member_status);
    const entityType = maybeText(r.entity_type);
    const priorityTier =
      typeof r.priority_tier === "number" && Number.isFinite(r.priority_tier)
        ? r.priority_tier
        : null;

    let investigatorId: string | null = null;
    let existingRawProfileJson: Record<string, unknown> = {};
    if (email) {
      const { data: existingByEmail, error: byEmailErr } = await supabase
        .from("investigators")
        .select("id,raw_profile_json")
        .ilike("email", email)
        .limit(1);
      if (byEmailErr) {
        errors.push(`Row ${i + 1}: ${byEmailErr.message}`);
        continue;
      }
      investigatorId = existingByEmail?.[0]?.id ?? null;
      existingRawProfileJson =
        ((existingByEmail?.[0]?.raw_profile_json as Record<string, unknown> | null) ?? {});
    }
    if (!investigatorId && nihProfileId) {
      const { data: existingByNih, error: byNihErr } = await supabase
        .from("investigators")
        .select("id,raw_profile_json")
        .eq("nih_profile_id", nihProfileId)
        .limit(1);
      if (byNihErr) {
        errors.push(`Row ${i + 1}: ${byNihErr.message}`);
        continue;
      }
      investigatorId = existingByNih?.[0]?.id ?? null;
      existingRawProfileJson =
        ((existingByNih?.[0]?.raw_profile_json as Record<string, unknown> | null) ?? existingRawProfileJson);
    }
    if (!investigatorId) {
      const { data: existingByName, error: byNameErr } = await supabase
        .from("investigators")
        .select("id,raw_profile_json")
        .ilike("full_name", displayName)
        .limit(1);
      if (byNameErr) {
        errors.push(`Row ${i + 1}: ${byNameErr.message}`);
        continue;
      }
      investigatorId = existingByName?.[0]?.id ?? null;
      existingRawProfileJson =
        ((existingByName?.[0]?.raw_profile_json as Record<string, unknown> | null) ?? existingRawProfileJson);
    }

    const signalRawProfile = {
      source: "signal",
      signal_entity_id: maybeText(r.id),
      signal_slug: maybeText(r.slug),
      signal_entity_type: entityType,
      signal_member_status: memberStatus,
      signal_priority_tier: priorityTier,
      signal_active: typeof r.active === "boolean" ? r.active : null,
      institution,
      pubmed_url: maybeText(r.pubmed_url),
      lab_website: maybeText(r.lab_website),
      google_alert_query: maybeText(r.google_alert_query),
      x_handle: maybeText(r.x_handle),
      bluesky_handle: maybeText(r.bluesky_handle),
      x_lab_handle: maybeText(r.x_lab_handle),
      bluesky_lab_handle: maybeText(r.bluesky_lab_handle),
      headshot_url:
        resolveSignalHeadshotUrl({
          headshot_url: maybeText(r.headshot_url),
          headshot_storage_path: maybeText(r.headshot_storage_path),
        }) ?? maybeText(r.headshot_url),
      headshot_storage_path: maybeText(r.headshot_storage_path),
      community_id: maybeText(r.community_id),
    };

    const invRow = {
      first_name: resolvedName.firstName || first || displayName,
      last_name: resolvedName.lastName || last || "",
      middle_initial: middleInitial ?? resolvedName.middleInitial,
      full_name: displayName,
      email,
      home_department: institution,
      division: null as string | null,
      rank: memberStatus,
      affiliations: institution ? [institution] : [],
      nih_profile_id: nihProfileId,
      raw_profile_json: {
        ...existingRawProfileJson,
        ...signalRawProfile,
      },
    };

    if (investigatorId) {
      const { error: updateErr } = await supabase
        .from("investigators")
        .update(invRow)
        .eq("id", investigatorId);
      if (updateErr) {
        errors.push(`Row ${i + 1}: ${updateErr.message}`);
        continue;
      }
      updated += 1;
    } else {
      const { data: insertedRow, error: insertErr } = await supabase
        .from("investigators")
        .insert(invRow)
        .select("id")
        .single();
      if (insertErr || !insertedRow) {
        errors.push(`Row ${i + 1}: ${insertErr?.message ?? "insert failed"}`);
        continue;
      }
      investigatorId = insertedRow.id;
      inserted += 1;
    }

    const feats = buildInvestigatorFeatureRow({
      primary_research_area: null,
      secondary_research_areas: null,
      primary_disease_focus: null,
      secondary_disease_focuses: null,
      technological_expertise: null,
      clinical_samples: null,
      biobanks: null,
      small_grants: null,
      large_grants: null,
      affiliations: institution ?? null,
      research_summary: null,
      division: null,
      rank: memberStatus,
    });

    const { error: featErr } = await supabase.from("investigator_profile_features").upsert(
      {
        investigator_id: investigatorId,
        ...feats,
      },
      { onConflict: "investigator_id" }
    );
    if (featErr) {
      errors.push(`Row ${i + 1} features: ${featErr.message}`);
      continue;
    }

    imported += 1;
  }

  revalidatePath("/investigators");
  revalidatePath("/portfolio-intelligence");
  revalidatePath("/portfolio-intelligence/data-sources");
  return { ok: true as const, imported, inserted, updated, errors };
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

    const rawProfileFromCsv = {
      ...d,
      affiliations_raw: d.affiliations,
    };

    const invBaseRow = {
      first_name: d.first_name,
      last_name: d.last_name,
      full_name: fullName(d.first_name, d.last_name),
      email: d.email || null,
      home_department: d.home_department || null,
      division: d.division || null,
      rank: d.rank || null,
      affiliations,
      nih_profile_id: d.nih_profile_id || null,
    };

    let invId: string;
    if (d.email) {
      const { data: existing } = await supabase
        .from("investigators")
        .select("id,raw_profile_json")
        .ilike("email", d.email.trim())
        .maybeSingle();

      if (existing?.id) {
        const invRow = {
          ...invBaseRow,
          raw_profile_json: {
            ...((existing.raw_profile_json as Record<string, unknown> | null) ?? {}),
            ...rawProfileFromCsv,
          },
        };
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
        const invRow = {
          ...invBaseRow,
          raw_profile_json: rawProfileFromCsv,
        };
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
      const invRow = {
        ...invBaseRow,
        raw_profile_json: rawProfileFromCsv,
      };
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

/** Remove a person from the directory (cascades to profile features, matches, caches, etc.). */
export async function deleteInvestigatorAction(investigatorId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const parsed = z.string().uuid().safeParse(investigatorId);
  if (!parsed.success) return { error: "Invalid person id" };

  const { error } = await supabase.from("investigators").delete().eq("id", parsed.data);
  if (error) return { error: error.message };

  revalidatePath("/investigators");
  revalidatePath("/portfolio-intelligence");
  revalidatePath("/portfolio-intelligence/data-sources");
  revalidatePath("/funding-opportunities");
  return { ok: true as const };
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
