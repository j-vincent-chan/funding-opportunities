/**
 * Verify a PubMed record lists the investigator as an author with UCSF affiliation
 * on that same author entry (esearch Author+Affiliation can match across co-authors).
 */

import { resolvePubmedInvestigatorName, type PubmedInvestigatorName } from "@/lib/community/pubmed-query";

export type PubmedParsedAuthor = {
  lastName: string;
  foreName: string;
  initials: string;
  affiliations: string[];
};

export type ResolvedPubmedName = ReturnType<typeof resolvePubmedInvestigatorName>;

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripInnerTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXmlEntities(stripInnerTags(match[1] ?? "")) : "";
}

export function parsePubmedArticleAuthors(xml: string): PubmedParsedAuthor[] {
  const authors: PubmedParsedAuthor[] = [];
  const authorBlocks = xml.match(/<Author\b[^>]*>[\s\S]*?<\/Author>/gi) ?? [];

  for (const block of authorBlocks) {
    if (/<CollectiveName>/i.test(block)) continue;
    const lastName = extractTag(block, "LastName");
    if (!lastName) continue;

    const affiliations: string[] = [];
    for (const match of block.matchAll(/<Affiliation>([\s\S]*?)<\/Affiliation>/gi)) {
      const text = decodeXmlEntities(stripInnerTags(match[1] ?? ""));
      if (text) affiliations.push(text);
    }

    authors.push({
      lastName,
      foreName: extractTag(block, "ForeName"),
      initials: extractTag(block, "Initials"),
      affiliations,
    });
  }

  return authors;
}

export function isUcsfAffiliation(text: string): boolean {
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  if (/\bucsf\b/.test(normalized)) return true;
  if (/university of california[, ]+san francisco/.test(normalized)) return true;
  if (/univ(?:ersity)?\.?\s+of\s+california[, ]+san\s+francisco/.test(normalized)) return true;
  if (/university of california[, ]+sf\b/.test(normalized)) return true;
  return false;
}

function normalizeLetters(value: string): string {
  return value.replace(/[^a-z]/gi, "").toLowerCase();
}

function lastNameMatches(authorLast: string, investigatorLast: string): boolean {
  return normalizeLetters(authorLast) === normalizeLetters(investigatorLast);
}

function normalizePart(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeNameToken(value: string): string {
  return value.replace(/\./g, "").trim().toLowerCase();
}

function firstNameMatches(
  author: PubmedParsedAuthor,
  investigatorFirst: string,
  requiredMiddle: string | null
): boolean {
  const target = normalizePart(investigatorFirst);
  if (!target) return false;

  const firstForeToken = normalizePart(author.foreName).split(/\s+/)[0] ?? "";
  const initials = normalizedAuthorInitials(author);
  const targetLower = normalizeNameToken(target);

  if (firstForeToken.length > 0) {
    const tokenLower = normalizeNameToken(firstForeToken);
    if (target.length >= 2) {
      if (tokenLower === targetLower) return true;
      if (tokenLower.startsWith(`${targetLower}-`)) return true;
      return false;
    }
    return tokenLower[0]?.toUpperCase() === target[0]?.toUpperCase();
  }

  if (requiredMiddle && target.length >= 2) {
    return false;
  }

  if (target.length >= 2) {
    if (initials.toLowerCase() === targetLower) return true;
    if (initials.length === 1 && targetLower.startsWith(initials.toLowerCase())) return true;
    return false;
  }

  const letter = target[0]!.toUpperCase();
  return initials[0] === letter;
}

function middleInitialMatches(author: PubmedParsedAuthor, requiredMiddle: string): boolean {
  const required = requiredMiddle.replace(/\./g, "").trim()[0]?.toUpperCase();
  if (!required) return true;

  const initials = normalizedAuthorInitials(author);
  const foreParts = author.foreName.split(/\s+/).filter(Boolean);

  if (foreParts.length >= 2) {
    const fromFore = foreParts[1]?.replace(/\./g, "")[0]?.toUpperCase();
    if (fromFore && fromFore !== required) return false;
  }

  if (initials.length >= 2 && initials[1] !== required) return false;

  if (initials.length >= 2 && initials[1] === required) return true;

  if (foreParts.length >= 2) {
    const fromFore = foreParts[1]?.replace(/\./g, "")[0]?.toUpperCase();
    if (fromFore === required) return true;
  }

  return false;
}

function normalizedAuthorInitials(author: PubmedParsedAuthor): string {
  return author.initials.replace(/[^A-Za-z]/g, "").toUpperCase();
}

export function authorEntryMatchesInvestigator(
  author: PubmedParsedAuthor,
  investigator: ResolvedPubmedName
): boolean {
  if (!lastNameMatches(author.lastName, investigator.lastName)) return false;
  if (!firstNameMatches(author, investigator.firstName, investigator.middleInitial)) return false;
  if (investigator.middleInitial && !middleInitialMatches(author, investigator.middleInitial)) {
    return false;
  }
  return author.affiliations.some(isUcsfAffiliation);
}

export function investigatorListedWithUcsfAffiliation(
  xml: string,
  investigator: PubmedInvestigatorName
): boolean {
  const resolved = resolvePubmedInvestigatorName(investigator);
  if (!resolved.lastName || !resolved.firstName) return false;
  const authors = parsePubmedArticleAuthors(xml);
  return authors.some((author) => authorEntryMatchesInvestigator(author, resolved));
}
