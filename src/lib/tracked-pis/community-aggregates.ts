/** Split comma/semicolon-separated tag lists from form exports. */
export function splitTagList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[;,]|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function displayLabel(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return t.length > 1 ? t[0].toUpperCase() + t.slice(1) : t.toUpperCase();
}

/** Count string occurrences; keys are display labels (title-ish). */
export function countOccurrences(
  values: (string | null | undefined)[]
): Map<string, number> {
  const m = new Map<string, number>();
  for (const v of values) {
    const t = v?.trim();
    if (!t) continue;
    const key = displayLabel(t);
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return m;
}

/** Count tokens from multi-value fields. */
export function countTokensFromFields(
  rows: (string | null | undefined)[]
): Map<string, number> {
  const m = new Map<string, number>();
  for (const raw of rows) {
    for (const tok of splitTagList(raw ?? "")) {
      const key = displayLabel(tok);
      m.set(key, (m.get(key) ?? 0) + 1);
    }
  }
  return m;
}

export type PiCommunityAggregates = {
  totalPis: number;
  withPrimaryResearchArea: number;
  withPrimaryDisease: number;
  byInstitution: Map<string, number>;
  primaryResearchArea: Map<string, number>;
  secondaryResearchTokens: Map<string, number>;
  primaryDisease: Map<string, number>;
  secondaryDiseaseTokens: Map<string, number>;
};

/** One row’s tag-shaped fields (Watched PI form or derived from investigator features). */
export type PiCommunityRow = {
  institution: string | null;
  primary_research_area: string | null;
  secondary_research_areas: string | null;
  primary_disease_focus: string | null;
  secondary_disease_focuses: string | null;
};

export function buildPiCommunityAggregates(rows: PiCommunityRow[]): PiCommunityAggregates {
  const totalPis = rows.length;
  const withPrimaryResearchArea = rows.filter((p) =>
    p.primary_research_area?.trim()
  ).length;
  const withPrimaryDisease = rows.filter((p) => p.primary_disease_focus?.trim()).length;

  const byInstitution = countOccurrences(rows.map((p) => p.institution));

  const primaryResearchArea = countOccurrences(
    rows.map((p) => p.primary_research_area)
  );

  const secondaryResearchTokens = countTokensFromFields(
    rows.map((p) => p.secondary_research_areas)
  );

  const primaryDisease = countOccurrences(rows.map((p) => p.primary_disease_focus));

  const secondaryDiseaseTokens = countTokensFromFields(
    rows.map((p) => p.secondary_disease_focuses)
  );

  return {
    totalPis,
    withPrimaryResearchArea,
    withPrimaryDisease,
    byInstitution,
    primaryResearchArea,
    secondaryResearchTokens,
    primaryDisease,
    secondaryDiseaseTokens,
  };
}

export function investigatorDbRowsToCommunityRows(
  rows: {
    home_department: string | null;
    division: string | null;
    investigator_profile_features:
      | { science_tags?: string[]; disease_tags?: string[] }
      | null
      | undefined;
  }[]
): PiCommunityRow[] {
  return rows.map((r) => {
    const st = r.investigator_profile_features?.science_tags ?? [];
    const dt = r.investigator_profile_features?.disease_tags ?? [];
    const inst = r.home_department?.trim() || r.division?.trim() || null;
    return {
      institution: inst,
      primary_research_area: st[0] ?? null,
      secondary_research_areas: st.length > 1 ? st.slice(1).join(", ") : null,
      primary_disease_focus: dt[0] ?? null,
      secondary_disease_focuses: dt.length > 1 ? dt.slice(1).join(", ") : null,
    };
  });
}

/** Top N entries by count descending. */
export function topCounts(
  m: Map<string, number>,
  n: number
): { name: string; count: number }[] {
  return Array.from(m.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}
