import { normalizeTextToTags } from "@/lib/normalization/normalize-text-to-tags";
import type { RawInvestigatorProfileInput } from "@/lib/investigators/normalize-investigator-features";
import type { PiQuickMatchProfile } from "./types";

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

function researchFromText(s: string | null | undefined): { science: string[]; translational: string[] } {
  const b = normalizeTextToTags(String(s ?? ""));
  return { science: b.science, translational: b.translational };
}

function diseaseFromText(s: string | null | undefined): string[] {
  return normalizeTextToTags(String(s ?? "")).disease;
}

function technicalFromText(s: string | null | undefined): string[] {
  return normalizeTextToTags(String(s ?? "")).method;
}

/**
 * Build a PI Quick Match profile from directory row + optional feature row + CSV/raw fields.
 */
export function buildPiQuickMatchProfile(
  inv: {
    id: string;
    full_name: string;
    home_department: string | null;
    division: string | null;
    raw_profile_json?: unknown;
  },
  feats?: {
    science_tags?: string[] | null;
    disease_tags?: string[] | null;
    method_tags?: string[] | null;
    translational_tags?: string[] | null;
  } | null
): PiQuickMatchProfile {
  const raw = (inv.raw_profile_json ?? {}) as Record<string, string | null | undefined>;
  const input: RawInvestigatorProfileInput = {
    primary_research_area: raw.primary_research_area,
    secondary_research_areas: raw.secondary_research_areas,
    primary_disease_focus: raw.primary_disease_focus,
    secondary_disease_focuses: raw.secondary_disease_focuses,
    technological_expertise: raw.technological_expertise,
  };

  const pr = researchFromText(input.primary_research_area);
  const sr = researchFromText(input.secondary_research_areas);
  const researchPrimary = uniq([...pr.science, ...pr.translational]);
  const researchSecondary = uniq([
    ...sr.science,
    ...sr.translational,
    ...(feats?.science_tags ?? []),
    ...(feats?.translational_tags ?? []),
  ]).filter((t) => !researchPrimary.includes(t));

  const diseasePrimary = uniq(diseaseFromText(input.primary_disease_focus));
  const diseaseSecondary = uniq([
    ...diseaseFromText(input.secondary_disease_focuses),
    ...(feats?.disease_tags ?? []),
  ]).filter((t) => !diseasePrimary.includes(t));

  const technical = uniq([
    ...technicalFromText(input.technological_expertise),
    ...(feats?.method_tags ?? []),
  ]);

  return {
    id: inv.id,
    full_name: inv.full_name,
    home_department: inv.home_department,
    division: inv.division,
    researchPrimary,
    researchSecondary,
    diseasePrimary,
    diseaseSecondary,
    technical,
  };
}
