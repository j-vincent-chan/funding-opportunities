/**
 * Strict PubMed esearch terms: author (last + first + optional middle initial) AND UCSF affiliation.
 */

const UCSF_AFFILIATION_CLAUSE = [
  '"University of California San Francisco"[Affiliation]',
  '"University of California, San Francisco"[Affiliation]',
  '"Univ of California San Francisco"[Affiliation]',
  '"University of California SF"[Affiliation]',
  "UCSF[Affiliation]",
].join(" OR ");

export type PubmedInvestigatorName = {
  firstName: string;
  lastName: string;
  middleInitial?: string | null;
  fullName?: string | null;
};

function normalizePart(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseNameFromFullName(fullName: string): {
  firstName: string;
  lastName: string;
  middleInitial: string | null;
} {
  const parts = normalizePart(fullName).split(" ").filter(Boolean);
  if (parts.length < 2) {
    return { firstName: parts[0] ?? "", lastName: "", middleInitial: null };
  }
  const firstName = parts[0] ?? "";
  const lastName = parts[parts.length - 1] ?? "";
  let middleInitial: string | null = null;
  if (parts.length >= 3) {
    const middle = parts.slice(1, -1).join(" ");
    const letter = middle.replace(/\./g, "").trim()[0];
    middleInitial = letter ? letter.toUpperCase() : null;
  }
  return { firstName, lastName, middleInitial };
}

function splitStructuredFirstName(firstName: string): {
  firstName: string;
  middleInitial: string | null;
} {
  const parts = normalizePart(firstName).split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const middleToken = parts[1]?.replace(/\./g, "").trim() ?? "";
    if (middleToken.length === 1) {
      return {
        firstName: parts[0] ?? "",
        middleInitial: middleToken.toUpperCase(),
      };
    }
  }
  return { firstName: normalizePart(firstName), middleInitial: null };
}

export function resolvePubmedInvestigatorName(input: PubmedInvestigatorName): {
  firstName: string;
  lastName: string;
  middleInitial: string | null;
} {
  const parsed = parseNameFromFullName(input.fullName ?? "");
  const fromFirstField = splitStructuredFirstName(normalizePart(input.firstName));
  const firstName = fromFirstField.firstName || parsed.firstName;
  const lastName = normalizePart(input.lastName) || parsed.lastName;
  const middleFromField = normalizePart(input.middleInitial ?? "")
    .replace(/\./g, "")
    .slice(0, 1)
    .toUpperCase();
  const middleInitial =
    middleFromField || fromFirstField.middleInitial || parsed.middleInitial || null;

  return { firstName, lastName, middleInitial };
}

/** PubMed author field: `Lee James C[Author]` when first + middle are known; else `He Peng[Author]`. */
export function pubmedAuthorVariants(
  lastName: string,
  firstName: string,
  middleInitial: string | null
): string[] {
  const last = normalizePart(lastName);
  const first = normalizePart(firstName);
  const firstLetter = first[0]?.toUpperCase();
  if (!last || !firstLetter) return [];

  if (middleInitial) {
    const mi = middleInitial.replace(/\./g, "").slice(0, 1).toUpperCase();
    if (first.length >= 2) {
      return [`${last} ${first} ${mi}[Author]`];
    }
    return [`${last} ${firstLetter}${mi}[Author]`];
  }
  if (first.length >= 2) {
    return [`${last} ${first}[Author]`];
  }
  return [`${last} ${firstLetter}[Author]`];
}

/** Names that need a middle initial for reliable PubMed disambiguation at UCSF. */
export function pubmedNameRequiresMiddleInitial(firstName: string, lastName: string): boolean {
  const first = normalizePart(firstName).toLowerCase();
  const last = normalizePart(lastName).toLowerCase();
  if (!first || !last) return false;
  if (last === "lee" && first === "james") return true;
  if (last === "wilson" && first === "michael") return true;
  if (last === "he" && (first === "peng" || first === "ping")) return true;
  return false;
}

export function pubmedNameResolutionError(input: PubmedInvestigatorName): string | null {
  const resolved = resolvePubmedInvestigatorName(input);
  if (!resolved.lastName || !resolved.firstName) {
    return "Set first and last name (or full_name) before refreshing PubMed.";
  }
  if (!resolved.middleInitial && pubmedNameRequiresMiddleInitial(resolved.firstName, resolved.lastName)) {
    return `Ambiguous name "${resolved.firstName} ${resolved.lastName}" — set middle_initial (e.g. C for James C Lee) and refresh again. PubMed uses Last + First + Middle Initial + UCSF affiliation.`;
  }
  return null;
}

/**
 * Build esearch term: (author variants) AND (UCSF affiliation variants).
 * Returns empty string when last/first cannot be resolved.
 */
export function buildStrictPubmedTerm(input: PubmedInvestigatorName): string {
  const { firstName, lastName, middleInitial } = resolvePubmedInvestigatorName(input);
  const authorVariants = pubmedAuthorVariants(lastName, firstName, middleInitial);
  if (authorVariants.length === 0) return "";

  const authorClause = authorVariants[0]!;
  return `(${authorClause}) AND (${UCSF_AFFILIATION_CLAUSE})`;
}
