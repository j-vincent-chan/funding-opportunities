/**
 * Match watchlist investigator names in free text (news articles, titles, etc.).
 */

export type WatchlistInvestigator = {
  id: string;
  firstName: string;
  lastName: string;
  middleInitial?: string | null;
  fullName: string;
};

export type InvestigatorNameMatcher = {
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

function wordBoundaryPattern(phrase: string): RegExp | null {
  const parts = phrase.split(/\s+/).map(normalizeNamePart).filter(Boolean);
  if (parts.length === 0) return null;
  const core = parts.map(escapeRegex).join("\\s+");
  return new RegExp(`(?:^|[^A-Za-z])${core}(?:[^A-Za-z]|$)`, "i");
}

export function buildInvestigatorNameMatchers(
  investigators: WatchlistInvestigator[]
): InvestigatorNameMatcher[] {
  const lastNameCounts = new Map<string, number>();
  for (const inv of investigators) {
    const last = normalizeNamePart(inv.lastName).toLowerCase();
    if (!last) continue;
    lastNameCounts.set(last, (lastNameCounts.get(last) ?? 0) + 1);
  }

  const matchers: InvestigatorNameMatcher[] = [];

  for (const inv of investigators) {
    const first = normalizeNamePart(inv.firstName);
    const last = normalizeNamePart(inv.lastName);
    const full = normalizeNamePart(inv.fullName);
    const patterns: RegExp[] = [];
    const seen = new Set<string>();

    const add = (phrase: string) => {
      const key = phrase.toLowerCase();
      if (seen.has(key)) return;
      const re = wordBoundaryPattern(phrase);
      if (!re) return;
      seen.add(key);
      patterns.push(re);
    };

    if (full.length >= 5) add(full);
    if (first.length >= 2 && last.length >= 2) {
      add(`${first} ${last}`);
      add(`${last}, ${first}`);
      if (first.length === 1) add(`${first}. ${last}`);
    }
    const lastKey = last.toLowerCase();
    if (
      last.length >= 6 &&
      lastNameCounts.get(lastKey) === 1 &&
      !/^(smith|brown|jones|nguyen|garcia|martinez|lee|kim|wang|chen|liu|zhang)$/i.test(last)
    ) {
      add(last);
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

export function findInvestigatorIdsInText(
  text: string,
  matchers: InvestigatorNameMatcher[]
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
  return [...matched];
}
