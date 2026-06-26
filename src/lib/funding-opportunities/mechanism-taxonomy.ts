import { coercePlainTextFromUnknown } from "@/lib/formatting/coerce-plain-text";
import { nihActivityCodeFromProjectNum } from "@/lib/community/nih-mechanism";

export type MechanismFamily =
  | "research_project"
  | "center"
  | "cooperative_agreement"
  | "training"
  | "career"
  | "fellowship"
  | "resource"
  | "instrumentation"
  | "construction"
  | "small_business";

export type MechanismScale =
  | "individual"
  | "multi_project"
  | "center"
  | "institutional"
  | "national_resource";

export type MechanismPurpose =
  | "research"
  | "technology_resource"
  | "core_support"
  | "training"
  | "career_development"
  | "infrastructure"
  | "clinical_network"
  | "data_resource";

export type MechanismGovernance = "grant" | "cooperative_agreement" | "contract";

export type MechanismSimilarityGroup =
  | "national_resource_center"
  | "institutional_core_center"
  | "specialized_research_center"
  | "investigator_research_project"
  | "exploratory_research"
  | "career_development"
  | "fellowship_training"
  | "institutional_training"
  | "small_business"
  | "instrumentation"
  | "construction"
  | "data_software_resource";

export type MechanismSimilarityLevel = "exact" | "very_high" | "high";

export type MechanismTaxonomyEntry = {
  activity_code: string;
  family: MechanismFamily;
  scale: MechanismScale;
  purposes: MechanismPurpose[];
  governance: MechanismGovernance;
  similarity_group: MechanismSimilarityGroup;
};

const ACTIVITY_CODE_TOKEN =
  /\b(R\d{2}[A-Z]?|K\d{2}[A-Z]?|P\d{2}[A-Z]?|F\d{2}[A-Z]?|T\d{2}[A-Z]?|U\d{2}[A-Z]?|X\d{2}[A-Z]?|DP\d|RM\d+|SC\d+)\b/gi;

/** Curated NIH activity-code taxonomy — extend here for admin review of unmatched codes. */
export const MECHANISM_TAXONOMY: Record<string, MechanismTaxonomyEntry> = {
  R01: {
    activity_code: "R01",
    family: "research_project",
    scale: "individual",
    purposes: ["research"],
    governance: "grant",
    similarity_group: "investigator_research_project",
  },
  R21: {
    activity_code: "R21",
    family: "research_project",
    scale: "individual",
    purposes: ["research"],
    governance: "grant",
    similarity_group: "exploratory_research",
  },
  R03: {
    activity_code: "R03",
    family: "research_project",
    scale: "individual",
    purposes: ["research"],
    governance: "grant",
    similarity_group: "exploratory_research",
  },
  R15: {
    activity_code: "R15",
    family: "research_project",
    scale: "institutional",
    purposes: ["research"],
    governance: "grant",
    similarity_group: "investigator_research_project",
  },
  R33: {
    activity_code: "R33",
    family: "research_project",
    scale: "individual",
    purposes: ["research"],
    governance: "grant",
    similarity_group: "exploratory_research",
  },
  R34: {
    activity_code: "R34",
    family: "research_project",
    scale: "individual",
    purposes: ["research"],
    governance: "grant",
    similarity_group: "exploratory_research",
  },
  R35: {
    activity_code: "R35",
    family: "research_project",
    scale: "individual",
    purposes: ["research"],
    governance: "grant",
    similarity_group: "investigator_research_project",
  },
  R37: {
    activity_code: "R37",
    family: "research_project",
    scale: "individual",
    purposes: ["research"],
    governance: "grant",
    similarity_group: "investigator_research_project",
  },
  R56: {
    activity_code: "R56",
    family: "research_project",
    scale: "individual",
    purposes: ["research"],
    governance: "grant",
    similarity_group: "exploratory_research",
  },
  U01: {
    activity_code: "U01",
    family: "cooperative_agreement",
    scale: "multi_project",
    purposes: ["research"],
    governance: "cooperative_agreement",
    similarity_group: "investigator_research_project",
  },
  U10: {
    activity_code: "U10",
    family: "cooperative_agreement",
    scale: "center",
    purposes: ["clinical_network"],
    governance: "cooperative_agreement",
    similarity_group: "specialized_research_center",
  },
  U19: {
    activity_code: "U19",
    family: "cooperative_agreement",
    scale: "center",
    purposes: ["research", "infrastructure"],
    governance: "cooperative_agreement",
    similarity_group: "specialized_research_center",
  },
  U24: {
    activity_code: "U24",
    family: "resource",
    scale: "national_resource",
    purposes: ["data_resource", "technology_resource"],
    governance: "cooperative_agreement",
    similarity_group: "national_resource_center",
  },
  U41: {
    activity_code: "U41",
    family: "resource",
    scale: "national_resource",
    purposes: ["technology_resource"],
    governance: "cooperative_agreement",
    similarity_group: "national_resource_center",
  },
  U54: {
    activity_code: "U54",
    family: "center",
    scale: "center",
    purposes: ["research", "infrastructure"],
    governance: "cooperative_agreement",
    similarity_group: "specialized_research_center",
  },
  P01: {
    activity_code: "P01",
    family: "center",
    scale: "multi_project",
    purposes: ["research"],
    governance: "grant",
    similarity_group: "specialized_research_center",
  },
  P20: {
    activity_code: "P20",
    family: "center",
    scale: "institutional",
    purposes: ["research", "infrastructure"],
    governance: "grant",
    similarity_group: "institutional_core_center",
  },
  P30: {
    activity_code: "P30",
    family: "center",
    scale: "institutional",
    purposes: ["core_support"],
    governance: "grant",
    similarity_group: "institutional_core_center",
  },
  P41: {
    activity_code: "P41",
    family: "resource",
    scale: "national_resource",
    purposes: ["technology_resource"],
    governance: "grant",
    similarity_group: "national_resource_center",
  },
  P50: {
    activity_code: "P50",
    family: "center",
    scale: "center",
    purposes: ["research"],
    governance: "grant",
    similarity_group: "specialized_research_center",
  },
  K01: {
    activity_code: "K01",
    family: "career",
    scale: "individual",
    purposes: ["career_development"],
    governance: "grant",
    similarity_group: "career_development",
  },
  K08: {
    activity_code: "K08",
    family: "career",
    scale: "individual",
    purposes: ["career_development"],
    governance: "grant",
    similarity_group: "career_development",
  },
  K12: {
    activity_code: "K12",
    family: "career",
    scale: "institutional",
    purposes: ["career_development", "training"],
    governance: "grant",
    similarity_group: "career_development",
  },
  K23: {
    activity_code: "K23",
    family: "career",
    scale: "individual",
    purposes: ["career_development"],
    governance: "grant",
    similarity_group: "career_development",
  },
  K24: {
    activity_code: "K24",
    family: "career",
    scale: "individual",
    purposes: ["career_development"],
    governance: "grant",
    similarity_group: "career_development",
  },
  K99: {
    activity_code: "K99",
    family: "career",
    scale: "individual",
    purposes: ["career_development"],
    governance: "grant",
    similarity_group: "career_development",
  },
  F31: {
    activity_code: "F31",
    family: "fellowship",
    scale: "individual",
    purposes: ["training"],
    governance: "grant",
    similarity_group: "fellowship_training",
  },
  F32: {
    activity_code: "F32",
    family: "fellowship",
    scale: "individual",
    purposes: ["training"],
    governance: "grant",
    similarity_group: "fellowship_training",
  },
  T32: {
    activity_code: "T32",
    family: "training",
    scale: "institutional",
    purposes: ["training"],
    governance: "grant",
    similarity_group: "institutional_training",
  },
  DP1: {
    activity_code: "DP1",
    family: "research_project",
    scale: "individual",
    purposes: ["research"],
    governance: "grant",
    similarity_group: "exploratory_research",
  },
  DP2: {
    activity_code: "DP2",
    family: "research_project",
    scale: "individual",
    purposes: ["research"],
    governance: "grant",
    similarity_group: "exploratory_research",
  },
  DP5: {
    activity_code: "DP5",
    family: "research_project",
    scale: "individual",
    purposes: ["research"],
    governance: "grant",
    similarity_group: "exploratory_research",
  },
};

const loggedUnmatchedMechanisms = new Set<string>();

export function normalizeActivityCode(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const upper = raw.trim().toUpperCase();
  const dp = upper.match(/^(DP\d)/)?.[1];
  if (dp) return dp;
  const rm = upper.match(/^(RM\d+)/)?.[1];
  if (rm) return rm;
  const sc = upper.match(/^(SC\d+)/)?.[1];
  if (sc) return sc;
  const standard = upper.match(/^([RUKPFTPX]\d{2})/)?.[1];
  if (standard) return standard;
  return upper;
}

export function lookupMechanismTaxonomy(activityCode: string | null | undefined): MechanismTaxonomyEntry | null {
  const code = normalizeActivityCode(activityCode);
  if (!code) return null;
  return MECHANISM_TAXONOMY[code] ?? null;
}

export function logUnmatchedMechanism(
  activityCode: string,
  context: { source: "funding_opportunity" | "investigator_grant"; reference?: string }
): void {
  const code = normalizeActivityCode(activityCode);
  if (!code || MECHANISM_TAXONOMY[code]) return;
  const key = `${context.source}:${code}`;
  if (loggedUnmatchedMechanisms.has(key)) return;
  loggedUnmatchedMechanisms.add(key);
  console.warn(
    "[mechanism-taxonomy] Unmatched activity code for admin review:",
    JSON.stringify({ activity_code: code, ...context })
  );
}

export function extractActivityCodesFromText(...parts: (string | null | undefined)[]): string[] {
  const found = new Set<string>();
  for (const part of parts) {
    if (!part?.trim()) continue;
    const re = new RegExp(ACTIVITY_CODE_TOKEN.source, ACTIVITY_CODE_TOKEN.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(part)) !== null) {
      const normalized = normalizeActivityCode(match[0]);
      if (normalized) found.add(normalized);
    }
  }
  return Array.from(found).sort((a, b) => a.localeCompare(b));
}

export function resolveFundingOpportunityActivityCode(input: {
  title?: unknown;
  description?: unknown;
  opportunity_number?: string | null;
  funding_instrument?: unknown;
}): string | null {
  const title = coercePlainTextFromUnknown(input.title);
  const description = coercePlainTextFromUnknown(input.description);
  const instrument = coercePlainTextFromUnknown(input.funding_instrument);
  const opportunityNumber = (input.opportunity_number ?? "").trim();

  const codes = extractActivityCodesFromText(title, description, instrument, opportunityNumber);
  if (codes.length === 0) return null;

  const inTaxonomy = codes.filter((code) => MECHANISM_TAXONOMY[code]);
  if (inTaxonomy.length === 1) return inTaxonomy[0]!;
  if (inTaxonomy.length > 1) {
    const dp = inTaxonomy.find((code) => code.startsWith("DP"));
    return dp ?? inTaxonomy[0]!;
  }

  const unknown = codes[0]!;
  logUnmatchedMechanism(unknown, {
    source: "funding_opportunity",
    reference: title.slice(0, 120) || opportunityNumber || undefined,
  });
  return unknown;
}

export function resolveGrantActivityCode(projectNum: string | null | undefined): string | null {
  const code = nihActivityCodeFromProjectNum(projectNum);
  if (!code) return null;
  const normalized = normalizeActivityCode(code);
  if (!normalized) return null;
  if (!MECHANISM_TAXONOMY[normalized]) {
    logUnmatchedMechanism(normalized, {
      source: "investigator_grant",
      reference: projectNum ?? undefined,
    });
  }
  return normalized;
}

function purposesOverlap(a: MechanismPurpose[], b: MechanismPurpose[]): boolean {
  return a.some((purpose) => b.includes(purpose));
}

function countTaxonomyAttributeMatches(
  left: MechanismTaxonomyEntry,
  right: MechanismTaxonomyEntry
): number {
  let count = 0;
  if (left.family === right.family) count += 1;
  if (left.scale === right.scale) count += 1;
  if (purposesOverlap(left.purposes, right.purposes)) count += 1;
  if (left.governance === right.governance) count += 1;
  return count;
}

/**
 * Classify mechanism similarity using the curated taxonomy only.
 * Returns null when similarity is below High (no medium/low tiers).
 */
export function classifyMechanismSimilarity(
  opportunityCode: string,
  grantCode: string
): MechanismSimilarityLevel | null {
  const opp = normalizeActivityCode(opportunityCode);
  const grant = normalizeActivityCode(grantCode);
  if (!opp || !grant) return null;

  if (opp === grant) return "exact";

  const oppEntry = lookupMechanismTaxonomy(opp);
  const grantEntry = lookupMechanismTaxonomy(grant);

  // Rule 6: missing taxonomy entry → exact matches only.
  if (!oppEntry || !grantEntry) return null;

  if (oppEntry.similarity_group !== grantEntry.similarity_group) return null;

  // Rule 2: very high — same group, scale, and purpose.
  if (oppEntry.scale === grantEntry.scale && purposesOverlap(oppEntry.purposes, grantEntry.purposes)) {
    return "very_high";
  }

  // Rule 3: high — same group and ≥2 of family, scale, purpose, governance.
  if (countTaxonomyAttributeMatches(oppEntry, grantEntry) >= 2) return "high";

  return null;
}

export function mechanismSimilarityRank(level: MechanismSimilarityLevel): number {
  if (level === "exact") return 3;
  if (level === "very_high") return 2;
  return 1;
}

export const MECHANISM_SIMILARITY_LABEL: Record<MechanismSimilarityLevel, string> = {
  exact: "Exact mechanism",
  very_high: "Very high similarity",
  high: "High similarity",
};

/** Reset deduped unmatched logs — for tests only. */
export function resetUnmatchedMechanismLogsForTests(): void {
  loggedUnmatchedMechanisms.clear();
}
