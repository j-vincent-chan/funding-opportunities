import {
  buildAgencyOrFilter,
  buildDepartmentAgencyOrFilter,
  buildNihIcTokensOverlapOrFilter,
  postgrestQuotedString,
  type DepartmentSubsSelection,
} from "./agency-filter";

const MAX_KEYWORD_LEN = 200;

export function normalizeKeyword(raw: string | undefined): string {
  if (!raw || typeof raw !== "string") return "";
  return raw.trim().slice(0, MAX_KEYWORD_LEN);
}

function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** PostgREST `or(...)` body: title / description / opportunity_number ilike (case-insensitive). */
export function buildKeywordOrFilter(keyword: string): string | null {
  const k = normalizeKeyword(keyword);
  if (!k) return null;
  const pat = `%${escapeIlikePattern(k)}%`;
  const q = postgrestQuotedString(pat);
  return `title.ilike.${q},description.ilike.${q},opportunity_number.ilike.${q}`;
}

export type FundingListAgencySelection = {
  departments: string[];
  departmentSubs: DepartmentSubsSelection;
  /** Legacy `?agency=` labels (exact / ilike) when no department filters are set. */
  legacyAgencies: string[];
};

/**
 * Apply keyword, department/agency, and NIH institute/center filters with AND semantics
 * across the three groups (a row must satisfy every active group), while keeping OR semantics
 * inside each group (any selected department/keyword matches).
 *
 * Built as a PostgREST logic tree `and(or(...keyword),or(...agency),nih_ic_tokens.ov.{...})`.
 * The NIH IC clause is AND-combined so selecting institutes narrows results to those institutes
 * (previously it was OR-combined, which let the broad department filter match every NIH row).
 */
export function applyFundingListOrFilters<T extends { or: (s: string) => T }>(
  query: T,
  keywordRaw: string | undefined,
  agency: FundingListAgencySelection,
  nihIcForOverlap: string[] = []
): T {
  const kw = buildKeywordOrFilter(keywordRaw ?? "");
  const deptSet = new Set(agency.departments);
  for (const [deptId, subs] of Object.entries(agency.departmentSubs)) {
    if (subs && subs.length > 0 && !deptSet.has(deptId)) {
      deptSet.add(deptId);
    }
  }
  const hasModern = deptSet.size > 0;
  const modernOr = hasModern
    ? buildDepartmentAgencyOrFilter(Array.from(deptSet), agency.departmentSubs)
    : null;
  const legacyOr =
    !hasModern && agency.legacyAgencies.length > 0 ? buildAgencyOrFilter(agency.legacyAgencies) : null;
  const deptCombined = modernOr ?? legacyOr;
  const icOverlap = buildNihIcTokensOverlapOrFilter(nihIcForOverlap);

  // Each entry is one AND-group; keyword/agency keep OR semantics internally, IC overlap is a single clause.
  const andTerms: string[] = [];
  if (kw) andTerms.push(`or(${kw})`);
  if (deptCombined) andTerms.push(`or(${deptCombined})`);
  if (icOverlap) andTerms.push(icOverlap);

  if (andTerms.length === 0) return query;
  // Single active group: emit it directly (avoids a redundant and(...) wrapper).
  if (andTerms.length === 1) {
    if (kw && !deptCombined && !icOverlap) return query.or(kw);
    if (deptCombined && !kw && !icOverlap) return query.or(deptCombined);
    return query.or(icOverlap as string);
  }
  return query.or(`and(${andTerms.join(",")})`);
}
