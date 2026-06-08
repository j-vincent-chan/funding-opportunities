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

const AMBIGUOUS_FIRST_NAMES = new Set([
  "james",
  "michael",
  "david",
  "john",
  "robert",
  "william",
  "richard",
  "thomas",
  "mark",
  "paul",
  "daniel",
  "andrew",
  "christopher",
  "matthew",
  "joseph",
  "kevin",
  "brian",
  "eric",
  "steven",
  "peter",
  "peng",
  "ping",
  "alexander",
  "benjamin",
  "samuel",
  "ryan",
  "justin",
  "joshua",
  "george",
  "charles",
  "anthony",
  "donald",
  "kenneth",
  "stephen",
  "timothy",
  "ronald",
  "edward",
  "jason",
  "jeffrey",
  "gregory",
  "patrick",
  "raymond",
  "jack",
  "dennis",
]);

const AMBIGUOUS_LAST_NAMES = new Set([
  "lee",
  "kim",
  "chen",
  "wang",
  "li",
  "zhang",
  "liu",
  "wu",
  "lin",
  "yang",
  "huang",
  "zhao",
  "zhou",
  "xu",
  "sun",
  "ma",
  "he",
  "wilson",
  "anderson",
  "brown",
  "jones",
  "johnson",
  "smith",
  "martin",
  "garcia",
  "nguyen",
  "chan",
  "wong",
  "park",
  "choi",
  "kang",
  "tan",
  "ho",
  "young",
  "king",
  "wright",
  "hill",
  "green",
  "adams",
  "baker",
  "nelson",
  "carter",
  "mitchell",
  "roberts",
  "turner",
  "phillips",
  "campbell",
  "parker",
  "evans",
  "edwards",
  "collins",
  "stewart",
  "morris",
  "rogers",
  "reed",
  "cook",
  "morgan",
  "bell",
  "murphy",
  "bailey",
  "rivera",
  "cooper",
  "richardson",
  "cox",
  "howard",
  "ward",
  "torres",
  "peterson",
  "gray",
  "ramirez",
  "james",
  "watson",
  "brooks",
  "kelly",
  "sanders",
  "price",
  "bennett",
  "wood",
  "barnes",
  "ross",
  "henderson",
  "coleman",
  "jenkins",
  "perry",
  "powell",
  "long",
  "patterson",
  "hughes",
  "flores",
  "washington",
  "butler",
  "simmons",
  "foster",
  "gonzalez",
  "bryant",
  "alexander",
  "russell",
  "griffin",
  "diaz",
  "hayes",
]);

/** Names that need a stored middle_initial for reliable PubMed disambiguation at UCSF. */
export function pubmedNameRequiresMiddleInitial(firstName: string, lastName: string): boolean {
  const first = normalizePart(firstName).toLowerCase();
  const last = normalizePart(lastName).toLowerCase();
  if (!first || !last) return false;
  if (last === "lee" && first === "james") return true;
  if (last === "wilson" && first === "michael") return true;
  if (last === "he" && (first === "peng" || first === "ping")) return true;
  if (AMBIGUOUS_FIRST_NAMES.has(first) && AMBIGUOUS_LAST_NAMES.has(last)) return true;
  return false;
}

/** When set, PubMed author XML must show a middle initial that matches (not just last+first+UCSF). */
export function strictMiddleRequiredOnAuthorRecord(
  resolved: ReturnType<typeof resolvePubmedInvestigatorName>
): boolean {
  if (!resolved.middleInitial) return false;
  if (!pubmedNameRequiresMiddleInitial(resolved.firstName, resolved.lastName)) return false;
  // Very short last names (He, Li, Wu) often only publish a single Initials letter in PubMed.
  if (normalizePart(resolved.lastName).length <= 2) return false;
  return true;
}

export function middleInitialFromColumn(input: PubmedInvestigatorName): string | null {
  const fromColumn = normalizePart(input.middleInitial ?? "")
    .replace(/\./g, "")
    .slice(0, 1)
    .toUpperCase();
  return fromColumn || null;
}

export function pubmedNameResolutionError(input: PubmedInvestigatorName): string | null {
  const resolved = resolvePubmedInvestigatorName(input);
  if (!resolved.lastName || !resolved.firstName) {
    return "Set first and last name (or full_name) before refreshing PubMed.";
  }
  if (!pubmedNameRequiresMiddleInitial(resolved.firstName, resolved.lastName)) {
    return null;
  }
  const fromColumn = middleInitialFromColumn(input);
  if (!fromColumn) {
    return `Ambiguous name "${resolved.firstName} ${resolved.lastName}" — set middle_initial on this investigator (e.g. C for James C Lee). PubMed uses Last + First + Middle Initial + UCSF affiliation; parsing from full_name alone is not allowed for this name.`;
  }
  if (!resolved.middleInitial) {
    return `Ambiguous name "${resolved.firstName} ${resolved.lastName}" — middle_initial "${fromColumn}" could not be aligned with first/last name.`;
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
