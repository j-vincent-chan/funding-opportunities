import { coercePlainTextFromUnknown } from "@/lib/formatting/coerce-plain-text";
import {
  isEsiCareerDevelopment,
  isInvestigatorInitiated,
  looksLargeCollaborativeGrant,
  type FundingQuickFilterRow,
} from "@/lib/funding-opportunities/funding-quick-filter-heuristics";
import {
  inferCollaborationComplexity,
  inferHumanSubjectsRelevance,
  inferMechanismType,
} from "@/lib/funding-opportunities/mechanism-heuristics";
import { buildPiQuickMatchProfile } from "@/lib/quick-match/normalize-pi";
import { rankInvestigatorsForOpportunity } from "@/lib/quick-match/engine";
import { extractOpportunityQuickTags } from "@/lib/quick-match/tag-opportunity";
import type { QuickMatchBuckets } from "@/lib/quick-match/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DeadlineUrgency = "closed" | "within_30" | "within_60" | "within_90" | "none";

export type PiDecisionBrief = {
  mechanismLabel: string;
  awardRangeLabel: string;
  daysToClose: number | null;
  deadlineUrgency: DeadlineUrgency;
  careerStageLabel: string;
  collaborationLabel: string;
  clinicalTrialLabel: string;
  humanSubjectsLabel: string;
  nihInstitutes: string[];
  announcementLabel: string;
  investigatorInitiated: boolean;
  earlyCareerFriendly: boolean;
  largeCollaborative: boolean;
  highlights: string[];
};

export type PiInvestigatorMatch = {
  investigatorId: string;
  fullName: string;
  department: string | null;
  matchScore: number;
};

export type SimilarGrantAwardee = {
  investigatorId: string;
  fullName: string;
  department: string | null;
  projectNum: string;
  projectTitle: string;
  fiscalYear: number;
  icName: string | null;
  topicOverlap: number;
};

type FundingOpportunityRow = {
  title: string;
  description?: unknown;
  agency?: string | null;
  agency_code?: string | null;
  opportunity_number?: string | null;
  close_date?: string | null;
  funding_instrument?: string | null;
  activity_families?: string[] | null;
  award_floor?: unknown;
  award_ceiling?: unknown;
  clinical_trial_mode?: string | null;
  nih_ic_tokens?: string[] | null;
  rd_announcement_class?: string | null;
  rd_investigator_tags?: string[] | null;
  rd_collaboration?: string | null;
  rd_human_subjects?: string | null;
  status?: string | null;
  forecasted?: boolean | null;
};

type GrantRow = {
  investigator_id: string;
  project_num: string;
  project_title: string | null;
  fiscal_year: number;
  ic_name: string | null;
  investigators: {
    id: string;
    full_name: string;
    home_department: string | null;
  } | null;
};

function parseAwardAmount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatAwardRange(floor: number | null, ceiling: number | null): string {
  if (floor != null && ceiling != null) {
    return `$${floor.toLocaleString()} – $${ceiling.toLocaleString()}`;
  }
  if (ceiling != null) return `Up to $${ceiling.toLocaleString()}`;
  if (floor != null) return `From $${floor.toLocaleString()}`;
  return "Not specified";
}

function daysUntilClose(closeDate: string | null, today: Date): number | null {
  if (!closeDate) return null;
  const close = new Date(closeDate);
  if (Number.isNaN(close.getTime())) return null;
  const start = new Date(today.toDateString());
  const end = new Date(close.toDateString());
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function deadlineUrgencyFromDays(days: number | null, statusBucket: string): DeadlineUrgency {
  if (statusBucket === "closed") return "closed";
  if (days == null || days < 0) return "none";
  if (days <= 30) return "within_30";
  if (days <= 60) return "within_60";
  if (days <= 90) return "within_90";
  return "none";
}

function mechanismLabelFromOpportunity(fo: FundingOpportunityRow, title: string, description: string): string {
  const families = Array.isArray(fo.activity_families) ? fo.activity_families : [];
  if (families.length > 0) {
    const joined = families.join(", ");
    const instrument = coercePlainTextFromUnknown(fo.funding_instrument);
    return instrument ? `${joined} · ${instrument}` : joined;
  }
  const inferred = inferMechanismType(title, description);
  const instrument = coercePlainTextFromUnknown(fo.funding_instrument);
  if (instrument) return instrument;
  if (inferred === "training") return "Career development / training";
  if (inferred === "center_like") return "Center / program project";
  if (inferred === "large_grant") return "Large research grant";
  if (inferred === "small_grant") return "Small / pilot grant";
  return "Research grant";
}

function filterRowFromOpportunity(fo: FundingOpportunityRow, title: string): FundingQuickFilterRow {
  return {
    title,
    agency: fo.agency ?? null,
    agency_code: fo.agency_code ?? null,
    close_date: fo.close_date ?? null,
    posted_date: null,
    funding_instrument: fo.funding_instrument ?? null,
    status: fo.status ?? null,
    forecasted: fo.forecasted ?? null,
    activity_families: fo.activity_families,
  };
}

function careerStageLabel(fo: FundingOpportunityRow, title: string): string {
  const tags = fo.rd_investigator_tags ?? [];
  if (tags.includes("early_stage_investigator") || tags.includes("new_investigator")) {
    return "Early-career friendly";
  }
  if (isEsiCareerDevelopment(filterRowFromOpportunity(fo, title))) {
    return "Career development (K/F/T)";
  }
  if (tags.includes("established_pi")) return "Established investigator";
  return "Open career stage";
}

function collaborationLabel(fo: FundingOpportunityRow, title: string, description: string): string {
  const stored = fo.rd_collaboration;
  if (stored && stored !== "unknown") {
    if (stored === "single_pi") return "Single PI";
    if (stored === "multi_pi") return "Multi-PI";
    if (stored === "center_like") return "Center / consortium";
  }
  const inferred = inferCollaborationComplexity(title, description);
  if (inferred === "single_pi") return "Single PI";
  if (inferred === "multi_pi") return "Multi-PI";
  if (inferred === "center_like") return "Center / consortium";
  return "Not specified";
}

function clinicalTrialLabel(mode: string | null | undefined): string {
  if (mode === "required") return "Clinical trial required";
  if (mode === "not_allowed") return "Clinical trial not allowed";
  if (mode === "allowed") return "Clinical trial allowed";
  return "Clinical trial rules unclear";
}

function humanSubjectsLabel(fo: FundingOpportunityRow, title: string, description: string): string {
  const stored = fo.rd_human_subjects;
  if (stored === "true") return "Human subjects expected";
  if (stored === "false") return "No human subjects indicated";
  const inferred = inferHumanSubjectsRelevance(title, description);
  if (inferred === "true") return "Human subjects likely";
  return "Human subjects unclear";
}

function announcementLabel(value: string | null | undefined): string {
  if (value === "parent_notice") return "Parent announcement (PA/PAR)";
  if (value === "targeted_rfa") return "Targeted RFA";
  if (value === "nos") return "Notice of special interest";
  if (value === "other") return "Program announcement";
  return "Standard funding notice";
}

export function buildPiDecisionBrief(
  fo: FundingOpportunityRow,
  statusBucket: "open" | "forecasted" | "closed",
  today = new Date(new Date().toDateString())
): PiDecisionBrief {
  const title = coercePlainTextFromUnknown(fo.title) || "";
  const description = coercePlainTextFromUnknown(fo.description) || "";
  const daysToClose = daysUntilClose(fo.close_date ?? null, today);
  const deadlineUrgency = deadlineUrgencyFromDays(daysToClose, statusBucket);
  const filterRow = filterRowFromOpportunity(fo, title);
  const investigatorInitiated = isInvestigatorInitiated(filterRow);
  const earlyCareerFriendly = isEsiCareerDevelopment(filterRow);
  const largeCollaborative = looksLargeCollaborativeGrant(filterRow);

  const highlights: string[] = [];
  if (deadlineUrgency === "within_30") highlights.push("Closing within 30 days — act soon.");
  else if (deadlineUrgency === "within_60") highlights.push("Closing within 60 days.");
  else if (deadlineUrgency === "within_90") highlights.push("Closing within 90 days.");
  if (earlyCareerFriendly) highlights.push("Explicitly targets early-career or training-stage investigators.");
  if (investigatorInitiated) highlights.push("Investigator-initiated research mechanism.");
  if (largeCollaborative) highlights.push("Large award or cooperative / multi-PI structure.");
  if ((fo.clinical_trial_mode ?? "") === "required") {
    highlights.push("Requires a clinical trial — confirm study team and timeline.");
  }
  if (parseAwardAmount(fo.award_ceiling) != null && parseAwardAmount(fo.award_ceiling)! >= 1_000_000) {
    highlights.push("Award ceiling is $1M+ — plan for significant scope and effort.");
  }
  if (highlights.length === 0) {
    highlights.push("Review mechanism, deadline, and fit against your current portfolio.");
  }

  return {
    mechanismLabel: mechanismLabelFromOpportunity(fo, title, description),
    awardRangeLabel: formatAwardRange(parseAwardAmount(fo.award_floor), parseAwardAmount(fo.award_ceiling)),
    daysToClose,
    deadlineUrgency,
    careerStageLabel: careerStageLabel(fo, title),
    collaborationLabel: collaborationLabel(fo, title, description),
    clinicalTrialLabel: clinicalTrialLabel(fo.clinical_trial_mode),
    humanSubjectsLabel: humanSubjectsLabel(fo, title, description),
    nihInstitutes: Array.isArray(fo.nih_ic_tokens) ? fo.nih_ic_tokens : [],
    announcementLabel: announcementLabel(fo.rd_announcement_class),
    investigatorInitiated,
    earlyCareerFriendly,
    largeCollaborative,
    highlights,
  };
}

function activityFamiliesForMatch(fo: FundingOpportunityRow): string[] {
  const set = new Set<string>();
  for (const family of fo.activity_families ?? []) {
    if (family) set.add(family.toUpperCase());
  }
  const instrument = coercePlainTextFromUnknown(fo.funding_instrument).toUpperCase();
  if (instrument.startsWith("R")) set.add("R");
  if (instrument.startsWith("K")) set.add("K");
  if (instrument.startsWith("U")) set.add("U");
  if (instrument.startsWith("P")) set.add("P");
  if (instrument.startsWith("F")) set.add("F");
  if (instrument.startsWith("T")) set.add("T");
  return Array.from(set);
}

function grantMatchesActivityFamily(projectNum: string, families: string[]): boolean {
  if (families.length === 0) return true;
  const upper = projectNum.toUpperCase();
  return families.some((family) => {
    if (family.length === 1) {
      return new RegExp(`^[15]?${family}\\d{2}`, "i").test(upper) || upper.includes(family);
    }
    return upper.includes(family);
  });
}

function icMatchesGrant(icName: string | null, institutes: string[]): boolean {
  if (!icName || institutes.length === 0) return true;
  const hay = icName.toUpperCase();
  return institutes.some((token) => hay.includes(token.toUpperCase()));
}

function topicOverlapScore(grantTitle: string, oppTags: QuickMatchBuckets): number {
  const grantTags = extractOpportunityQuickTags({
    title: grantTitle,
    description: null,
    agency: null,
    agency_code: null,
    category: null,
    funding_instrument: null,
    applicant_types: null,
    raw_payload_json: null,
  });
  let overlap = 0;
  for (const tag of oppTags.research_focal_areas) {
    if (grantTags.research_focal_areas.includes(tag)) overlap += 2;
  }
  for (const tag of oppTags.disease_areas) {
    if (grantTags.disease_areas.includes(tag)) overlap += 2;
  }
  for (const tag of oppTags.technical_expertise) {
    if (grantTags.technical_expertise.includes(tag)) overlap += 1;
  }
  return overlap;
}

export async function loadPiInvestigatorMatches(
  supabase: SupabaseClient,
  oppTags: QuickMatchBuckets,
  limit = 5
): Promise<PiInvestigatorMatch[]> {
  const { data: invRows } = await supabase
    .from("investigators")
    .select(
      "id, full_name, home_department, division, raw_profile_json, investigator_profile_features(science_tags, disease_tags, method_tags, translational_tags)"
    )
    .order("full_name", { ascending: true })
    .limit(500);

  const profiles = (invRows ?? []).map((row) => {
    const rawFeats = row.investigator_profile_features as unknown;
    const feats = Array.isArray(rawFeats) ? rawFeats[0] : rawFeats;
    return buildPiQuickMatchProfile(
      row,
      feats as
        | {
            science_tags: string[] | null;
            disease_tags: string[] | null;
            method_tags: string[] | null;
            translational_tags: string[] | null;
          }
        | null
        | undefined
    );
  });

  return rankInvestigatorsForOpportunity(oppTags, profiles, limit).map((match) => ({
    investigatorId: match.pi.id,
    fullName: match.pi.full_name,
    department: match.pi.home_department,
    matchScore: match.totalScore,
  }));
}

export async function loadSimilarGrantAwardees(
  supabase: SupabaseClient,
  fo: FundingOpportunityRow,
  oppTags: QuickMatchBuckets,
  limit = 8
): Promise<SimilarGrantAwardee[]> {
  const families = activityFamiliesForMatch(fo);
  const institutes = Array.isArray(fo.nih_ic_tokens) ? fo.nih_ic_tokens : [];

  const { data: grantRows } = await supabase
    .from("investigator_nih_grants")
    .select(
      "investigator_id, project_num, project_title, fiscal_year, ic_name, investigators(id, full_name, home_department)"
    )
    .order("fiscal_year", { ascending: false })
    .limit(4000);

  const byInvestigator = new Map<string, SimilarGrantAwardee>();

  for (const raw of grantRows ?? []) {
    const row = raw as unknown as GrantRow;
    const inv = row.investigators;
    if (!inv?.id || !row.project_num) continue;
    if (!grantMatchesActivityFamily(row.project_num, families)) continue;
    if (!icMatchesGrant(row.ic_name, institutes)) continue;

    const title = row.project_title?.trim() || row.project_num;
    const overlap = topicOverlapScore(title, oppTags);
    const existing = byInvestigator.get(inv.id);
    if (
      existing &&
      (existing.fiscalYear > row.fiscal_year ||
        (existing.fiscalYear === row.fiscal_year && existing.topicOverlap >= overlap))
    ) {
      continue;
    }

    byInvestigator.set(inv.id, {
      investigatorId: inv.id,
      fullName: inv.full_name,
      department: inv.home_department,
      projectNum: row.project_num,
      projectTitle: title,
      fiscalYear: row.fiscal_year,
      icName: row.ic_name,
      topicOverlap: overlap,
    });
  }

  return Array.from(byInvestigator.values())
    .sort(
      (a, b) =>
        b.topicOverlap - a.topicOverlap ||
        b.fiscalYear - a.fiscalYear ||
        a.fullName.localeCompare(b.fullName)
    )
    .slice(0, limit);
}
