import {
  buildAgencyOrFilter,
  buildDepartmentAgencyOrFilter,
  buildNihIcTokensOverlapOrFilter,
  postgrestQuotedString,
  type DepartmentSubsSelection,
} from "./agency-filter";

const MAX_KEYWORD_LEN = 200;

/** Curly/smart apostrophe variants normalized to ASCII `'` before search expansion. */
const APOSTROPHE_LIKE = /[\u2018\u2019\u201B']/g;

const KEYWORD_STOP_WORDS = new Set([
  "the",
  "and",
  "or",
  "to",
  "a",
  "an",
  "of",
  "for",
  "through",
  "in",
  "on",
  "at",
  "by",
  "with",
  "from",
  "into",
  "over",
  "under",
]);

/** Minimum significant tokens before emitting an all-tokens-must-match clause. */
const MIN_TOKEN_AND_COUNT = 2;

/** NIH-style activity codes (P41, R01, U01, …) — kept even when shorter than 4 chars. */
const GRANT_MECHANISM_TOKEN = /^[a-z]\d{2}(?:[a-z]\d{2})?$/i;

export function normalizeKeyword(raw: string | undefined): string {
  if (!raw || typeof raw !== "string") return "";
  return raw.trim().slice(0, MAX_KEYWORD_LEN);
}

function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function normalizeApostrophes(keyword: string): string {
  return keyword.replace(APOSTROPHE_LIKE, "'");
}

/**
 * Escape user text for ILIKE, but keep `_` wildcards that stand in for apostrophes.
 */
function toIlikeCore(variant: string): string {
  let out = "";
  const normalized = normalizeApostrophes(variant);
  for (const ch of normalized) {
    if (ch === "'") {
      out += "_";
      continue;
    }
    if (ch === "\\") out += "\\\\";
    else if (ch === "%") out += "\\%";
    else if (ch === "_") out += "\\_";
    else out += ch;
  }
  return out;
}

/**
 * Typing "Nations" instead of "Nation's" — insert a possessive apostrophe so {@link toIlikeCore}
 * can encode it as `Nation_s` and match the stored title.
 */
function possessiveApostropheInsertedVariant(keyword: string): string | null {
  const next = keyword.replace(/\b([A-Za-z]{3,})s\b/g, "$1's");
  return next !== keyword ? next : null;
}

/**
 * Expand a keyword into text variants (apostrophe normalization / possessive stripping).
 * Apostrophe-safe ilike encoding happens in {@link toIlikeCore}.
 */
export function keywordSearchVariants(keyword: string): string[] {
  const k = normalizeApostrophes(normalizeKeyword(keyword));
  if (!k) return [];

  const variants = new Set<string>();
  variants.add(k);

  const possessiveInserted = possessiveApostropheInsertedVariant(k);
  if (possessiveInserted) variants.add(possessiveInserted);

  const withoutPossessive = k.replace(/'s\b/gi, "").replace(/\s+/g, " ").trim();
  if (withoutPossessive) variants.add(withoutPossessive);

  const withoutApostrophes = k.replace(/'/g, "").replace(/\s+/g, " ").trim();
  if (withoutApostrophes) variants.add(withoutApostrophes);

  return Array.from(variants);
}

function isSignificantSearchToken(word: string): boolean {
  if (KEYWORD_STOP_WORDS.has(word)) return false;
  if (GRANT_MECHANISM_TOKEN.test(word)) return true;
  return word.length >= 4;
}

/** Distinct words (len ≥ 4 or grant mechanism codes, not stop words) for token-AND fallback. */
export function significantSearchTokens(keyword: string): string[] {
  const k = normalizeApostrophes(normalizeKeyword(keyword)).toLowerCase();
  const words = k
    .split(/\s+/)
    .map((w) => w.replace(/'/g, "").replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean);
  const tokens = words.filter(isSignificantSearchToken);
  return Array.from(new Set(tokens));
}

function ilikeFieldTriplet(pattern: string): string[] {
  const q = postgrestQuotedString(pattern);
  return [`title.ilike.${q}`, `description.ilike.${q}`, `opportunity_number.ilike.${q}`];
}

function tokenMatchOrGroup(token: string): string {
  const patterns = new Set<string>([`%${escapeIlikePattern(token)}%`]);
  if (token.length >= 4 && token.endsWith("s")) {
    const stem = token.slice(0, -1);
    if (stem.length >= 3) {
      patterns.add(`%${escapeIlikePattern(stem)}_%`);
    }
  } else if (token.length >= 4) {
    // Match simple plurals (e.g. center → Centers).
    patterns.add(`%${escapeIlikePattern(token)}_%`);
  }
  const fieldClauses = Array.from(patterns).flatMap((pat) => {
    const q = postgrestQuotedString(pat);
    return [`title.ilike.${q}`, `description.ilike.${q}`, `opportunity_number.ilike.${q}`];
  });
  return `or(${fieldClauses.join(",")})`;
}

/**
 * When tokens are separated in the title (e.g. "NCBIB) (P41") or middle words are omitted,
 * require every significant token to appear somewhere in title / description / opportunity number.
 */
function buildKeywordTokenAndClause(keyword: string): string | null {
  const tokens = significantSearchTokens(keyword);
  if (tokens.length < MIN_TOKEN_AND_COUNT) return null;

  const tokenGroups = tokens.map((token) => tokenMatchOrGroup(token));
  return `and(${tokenGroups.join(",")})`;
}

/** PostgREST `or(...)` body: title / description / opportunity_number ilike (case-insensitive). */
export function buildKeywordOrFilter(keyword: string): string | null {
  const variants = keywordSearchVariants(keyword);
  if (variants.length === 0) return null;

  const clauses = new Set<string>();
  for (const variant of variants) {
    const pat = `%${toIlikeCore(variant)}%`;
    for (const clause of ilikeFieldTriplet(pat)) {
      clauses.add(clause);
    }
  }

  const tokenAnd = buildKeywordTokenAndClause(keyword);
  if (tokenAnd) clauses.add(tokenAnd);

  return Array.from(clauses).join(",");
}

export type FundingListAgencySelection = {
  departments: string[];
  departmentSubs: DepartmentSubsSelection;
  /** Legacy `?agency=` labels (exact / ilike) when no department filters are set. */
  legacyAgencies: string[];
  /** When true (`dept=none`), the user cleared every department — return no rows. */
  noDepartmentsSelected?: boolean;
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
  if (agency.noDepartmentsSelected) {
    const impossibleId = postgrestQuotedString("00000000-0000-0000-0000-000000000000");
    return query.or(`id.eq.${impossibleId}`);
  }

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
