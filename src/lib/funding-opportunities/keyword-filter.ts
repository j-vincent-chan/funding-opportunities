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
 * Apply keyword (OR across text columns) and/or agency filters with correct AND semantics
 * when both are present (PostgREST `and=(or(...keyword),or(...agency))` via nested `or`).
 *
 * NIH institute/center tokens (`nihIcForOrOverlap`) are OR-combined with department/legacy
 * agency clauses — not AND — so rows match either the department filter or the IC token filter.
 */
export function applyFundingListOrFilters<T extends { or: (s: string) => T }>(
  query: T,
  keywordRaw: string | undefined,
  agency: FundingListAgencySelection,
  nihIcForOrOverlap: string[] = []
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
  const icOr = buildNihIcTokensOverlapOrFilter(nihIcForOrOverlap);

  let ag: string | null = null;
  if (deptCombined && icOr) {
    ag = `${deptCombined},${icOr}`;
  } else if (deptCombined) {
    ag = deptCombined;
  } else if (icOr) {
    ag = icOr;
  }

  if (kw && ag) return query.or(`and(or(${kw}),or(${ag}))`);
  if (kw) return query.or(kw);
  if (ag) return query.or(ag);
  return query;
}
