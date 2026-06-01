/**
 * UCSF News watchlist linking: match only when the investigator's full name appears
 * as a contiguous phrase (or Last, First form), not isolated first/last tokens in prose.
 */

import type { WatchlistInvestigator } from "@/lib/community/investigator-name-matching";

export type UcsfNewsNameMatcher = {
  id: string;
  displayName: string;
  patterns: RegExp[];
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeNamePart(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Require the full phrase adjacent (flexible internal whitespace / optional periods). */
function contiguousPhrasePattern(phrase: string): RegExp | null {
  const parts = normalizeNamePart(phrase).split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const core = parts.map(escapeRegex).join("\\s+\\.?\\s*");
  return new RegExp(`(?:^|[^A-Za-z])${core}(?:[^A-Za-z]|$)`, "i");
}

export function buildUcsfNewsNameMatchers(investigators: WatchlistInvestigator[]): UcsfNewsNameMatcher[] {
  const matchers: UcsfNewsNameMatcher[] = [];

  for (const inv of investigators) {
    const first = normalizeNamePart(inv.firstName);
    const last = normalizeNamePart(inv.lastName);
    const middle = normalizeNamePart(inv.middleInitial ?? "")
      .replace(/\./g, "")
      .slice(0, 1)
      .toUpperCase();
    const full = normalizeNamePart(inv.fullName);

    const patterns: RegExp[] = [];
    const seen = new Set<string>();

    const addPhrase = (phrase: string) => {
      const key = phrase.toLowerCase();
      if (seen.has(key)) return;
      const re = contiguousPhrasePattern(phrase);
      if (!re) return;
      seen.add(key);
      patterns.push(re);
    };

    if (full.length >= 5) {
      addPhrase(full);
    } else if (first.length >= 2 && last.length >= 2) {
      addPhrase(`${first} ${last}`);
    }

    if (last.length >= 2 && first.length >= 2) {
      addPhrase(`${last}, ${first}`);
      if (middle) {
        addPhrase(`${last}, ${first} ${middle}`);
        addPhrase(`${last}, ${first} ${middle}.`);
      }
    }

    if (patterns.length === 0) continue;
    matchers.push({
      id: inv.id,
      displayName: full || `${first} ${last}`.trim(),
      patterns,
    });
  }

  return matchers;
}

export function findUcsfNewsInvestigatorIdsInText(
  text: string,
  matchers: UcsfNewsNameMatcher[]
): string[] {
  if (!text.trim() || matchers.length === 0) return [];
  const haystack = text.replace(/\s+/g, " ");
  const matched = new Set<string>();
  for (const matcher of matchers) {
    if (matched.has(matcher.id)) continue;
    for (const pattern of matcher.patterns) {
      if (pattern.test(haystack)) {
        matched.add(matcher.id);
        break;
      }
    }
  }
  return Array.from(matched);
}
