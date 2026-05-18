import { TOP_LEVEL_DEPARTMENTS } from "@/lib/funding-opportunities/agency-taxonomy";
import {
  getAllSubPatternsForDepartment,
  getSubcomponentsForDepartment,
  isKnownDepartmentSubId,
} from "@/lib/funding-opportunities/department-subcomponents";

export type DepartmentSubsSelection = Partial<Record<string, string[]>>;

/** PostgREST string literal for use inside .or(...) filter fragments. */
export function postgrestQuotedString(s: string): string {
  return `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Match stored rows where either agency or agency_code equals one of the selected labels
 * (same string can appear in either column depending on Simpler payload).
 * Also match `agency.ilike.%sel%` so rows still stored with a leading org code (e.g. "69A345 Office …")
 * match the normalized label shown in filters.
 */
export function buildAgencyOrFilter(selected: string[]): string {
  return selected
    .flatMap((sel) => {
      const q = postgrestQuotedString(sel);
      const ilikePat = `%${escapeIlikePattern(sel)}%`;
      const iq = postgrestQuotedString(ilikePat);
      return [`agency.eq.${q}`, `agency_code.eq.${q}`, `agency.ilike.${iq}`];
    })
    .join(",");
}

function ilikeAgencyPair(substr: string): string[] {
  const iq = postgrestQuotedString(`%${escapeIlikePattern(substr)}%`);
  return [`agency.ilike.${iq}`, `agency_code.ilike.${iq}`];
}

/**
 * OR across department / sub-agency ilike clauses (matches `agency` or `agency_code` text).
 * Departments with defined subcomponents: if none selected, matches the broad union (parent + all subs);
 * if specific subs are selected, only those patterns apply.
 */
export function buildDepartmentAgencyOrFilter(
  departmentIds: string[],
  departmentSubs: DepartmentSubsSelection
): string | null {
  const clauses: string[] = [];

  for (const id of departmentIds) {
    const def = TOP_LEVEL_DEPARTMENTS.find((d) => d.id === id);
    if (!def) continue;
    const subsDef = getSubcomponentsForDepartment(id);
    if (subsDef.length === 0) {
      for (const pat of def.patterns) {
        clauses.push(...ilikeAgencyPair(pat));
      }
      continue;
    }
    const selected = (departmentSubs[id] ?? []).filter((s) => isKnownDepartmentSubId(id, s));
    if (selected.length > 0) {
      for (const sid of selected) {
        const sub = subsDef.find((c) => c.id === sid);
        if (!sub) continue;
        for (const pat of sub.patterns) {
          clauses.push(...ilikeAgencyPair(pat));
        }
      }
    } else {
      for (const pat of getAllSubPatternsForDepartment(id, def.patterns)) {
        clauses.push(...ilikeAgencyPair(pat));
      }
    }
  }

  if (clauses.length === 0) return null;
  return clauses.join(",");
}

/**
 * PostgREST fragment matching `nih_ic_tokens` overlap with any of the IC abbreviations
 * (same semantics as `.overlaps('nih_ic_tokens', tokens)`).
 */
export function buildNihIcTokensOverlapOrFilter(icTokens: string[]): string | null {
  if (icTokens.length === 0) return null;
  const safe = icTokens.map((t) => t.replace(/[^A-Z0-9]/gi, "")).filter((t) => t.length > 0);
  if (safe.length === 0) return null;
  return `nih_ic_tokens.ov.{${safe.join(",")}}`;
}
