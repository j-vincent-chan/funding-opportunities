import { mergeTagBuckets, normalizeTextToTags, type TagBuckets } from "@/lib/normalization/normalize-text-to-tags";

export type RawInvestigatorProfileInput = {
  primary_research_area?: string | null;
  secondary_research_areas?: string | null;
  primary_disease_focus?: string | null;
  secondary_disease_focuses?: string | null;
  technological_expertise?: string | null;
  clinical_samples?: string | null;
  biobanks?: string | null;
  small_grants?: string | null;
  large_grants?: string | null;
  affiliations?: string | null;
  research_summary?: string | null;
  division?: string | null;
  rank?: string | null;
};

export type GrantReadiness = "high" | "medium" | "low" | "unknown";

function inferReadiness(text: string): GrantReadiness {
  const t = text.toLowerCase();
  if (!t.trim()) return "unknown";
  if (/\b(r01|u01|p01|center|sc1|dp2|rm1)\b/.test(t) || /\bmultiple\b.*\b(r01|grant)/.test(t))
    return "high";
  if (/\b(r21|r03|k99|k08|f31|f32|pilot|exploratory)\b/.test(t)) return "medium";
  if (/\bnone\b|\bno\b|\bn\/a\b/.test(t) && t.length < 40) return "low";
  if (t.length > 80) return "medium";
  return "unknown";
}

export type CollaborationPreference = "lead" | "collaborator" | "either" | "unknown";

function inferCollaborationRole(small: string, large: string): CollaborationPreference {
  const blob = `${small} ${large}`.toLowerCase();
  if (!blob.trim()) return "unknown";
  const lead =
    /\b(pi|multiple pi|contact pi|program director|project lead)\b/.test(blob) &&
    !/\b(co-?i|collaborator only|supporting)\b/.test(blob);
  const collab = /\b(co-?i|collaborator|core|shared|supporting)\b/.test(blob);
  if (lead && collab) return "either";
  if (lead) return "lead";
  if (collab) return "collaborator";
  return "unknown";
}

function combineBuckets(input: RawInvestigatorProfileInput): TagBuckets {
  const parts: string[] = [
    input.primary_research_area,
    input.secondary_research_areas,
    input.primary_disease_focus,
    input.secondary_disease_focuses,
    input.technological_expertise,
    input.clinical_samples,
    input.biobanks,
    input.affiliations,
    input.research_summary,
    input.division,
    input.rank,
  ]
    .filter(Boolean)
    .map((s) => String(s));

  return parts.reduce<TagBuckets>(
    (acc, chunk) => mergeTagBuckets(acc, normalizeTextToTags(chunk)),
    {
      science: [],
      disease: [],
      method: [],
      translational: [],
      fallbackText: "",
    }
  );
}

export const INVESTIGATOR_NORMALIZATION_VERSION = "inv-v1";

export function buildInvestigatorFeatureRow(input: RawInvestigatorProfileInput): {
  science_tags: string[];
  disease_tags: string[];
  method_tags: string[];
  translational_tags: string[];
  grant_readiness_small: GrantReadiness | string;
  grant_readiness_large: GrantReadiness | string;
  collaboration_role_preference: CollaborationPreference;
  profile_summary_normalized: string;
  normalization_version: string;
} {
  const buckets = combineBuckets(input);
  const grant_readiness_small = inferReadiness(input.small_grants ?? "");
  const grant_readiness_large = inferReadiness(input.large_grants ?? "");
  const collaboration_role_preference = inferCollaborationRole(
    input.small_grants ?? "",
    input.large_grants ?? ""
  );

  const summaryParts = [
    ...buckets.science.map((t) => t.replaceAll("_", " ")),
    ...buckets.disease.map((t) => t.replaceAll("_", " ")),
    ...buckets.method.map((t) => t.replaceAll("_", " ")),
    ...buckets.translational.map((t) => t.replaceAll("_", " ")),
    buckets.fallbackText,
  ].filter(Boolean);

  const profile_summary_normalized = Array.from(new Set(summaryParts.join(" ").split(/\s+/)))
    .filter(Boolean)
    .join(" ")
    .slice(0, 8000);

  return {
    science_tags: buckets.science,
    disease_tags: buckets.disease,
    method_tags: buckets.method,
    translational_tags: buckets.translational,
    grant_readiness_small,
    grant_readiness_large,
    collaboration_role_preference,
    profile_summary_normalized,
    normalization_version: INVESTIGATOR_NORMALIZATION_VERSION,
  };
}
