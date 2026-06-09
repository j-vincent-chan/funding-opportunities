import {
  DISEASE_CANONICAL,
  DISEASE_SYNONYMS,
  METHOD_CANONICAL,
  METHOD_SYNONYMS,
  SCIENCE_CANONICAL,
  SCIENCE_SYNONYMS,
  TRANSLATIONAL_CANONICAL,
  TRANSLATIONAL_SYNONYMS,
} from "./vocab-config";

export type TagBuckets = {
  science: string[];
  disease: string[];
  method: string[];
  translational: string[];
  /** Lowercased tokens/phrases not mapped to a canonical tag */
  fallbackText: string;
};

const SCIENCE_SET = new Set<string>(SCIENCE_CANONICAL);
const DISEASE_SET = new Set<string>(DISEASE_CANONICAL);
const METHOD_SET = new Set<string>(METHOD_CANONICAL);
const TRANS_SET = new Set<string>(TRANSLATIONAL_CANONICAL);

function uniqSorted(arr: string[]): string[] {
  return Array.from(new Set(arr)).sort();
}

/** Lowercase, collapse whitespace, normalize punctuation to spaces */
export function preprocessText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^a-z0-9+#'\-./\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Require phrase boundaries so short tokens (e.g. tme, ai) do not match inside unrelated words. */
function phraseBoundaryPattern(phrase: string): RegExp {
  const body = escapeRegExp(phrase).replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![a-z0-9])${body}(?![a-z0-9])`, "gi");
}

function longestPhraseMatch(
  text: string,
  synonyms: Record<string, string>
): Map<string, string> {
  const keys = Object.keys(synonyms).sort((a, b) => b.length - a.length);
  const out = new Map<string, string>();
  let remaining = text;
  for (const phrase of keys) {
    if (!phrase.trim()) continue;
    const pattern = phraseBoundaryPattern(phrase);
    let match = pattern.exec(remaining);
    while (match) {
      const canon = synonyms[phrase];
      out.set(canon, phrase);
      const idx = match.index;
      remaining =
        remaining.slice(0, idx) + " ".repeat(match[0].length) + remaining.slice(idx + match[0].length);
      pattern.lastIndex = 0;
      match = pattern.exec(remaining);
    }
  }
  return out;
}

/** Drop clinical-trial mentions that are exclusions, not methodological requirements. */
export function stripNegatedClinicalTrialPhrases(text: string): string {
  return text
    .replace(/clinical trials?(?:\s+stud(?:y|ies))?\s+not\s+(?:allowed|permitted|required)/gi, " ")
    .replace(/clinical trials?\s+not\s+(?:allowed|permitted|required)/gi, " ")
    .replace(/(?:no|not)\s+clinical trials?(?:\s+stud(?:y|ies))?(?:\s+allowed|\s+permitted)?/gi, " ")
    .replace(/non[-\s]?clinical(?:\s+trial)?/gi, " ");
}

function tokensFrom(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Map free text to canonical tags + a fallback searchable blob.
 */
export function normalizeTextToTags(raw: string): TagBuckets {
  const pre = preprocessText(raw);
  if (!pre) {
    return {
      science: [],
      disease: [],
      method: [],
      translational: [],
      fallbackText: "",
    };
  }

  const science = new Set<string>();
  const disease = new Set<string>();
  const method = new Set<string>();
  const translational = new Set<string>();

  for (const canon of Array.from(longestPhraseMatch(pre, SCIENCE_SYNONYMS).keys())) {
    science.add(canon);
  }
  for (const canon of Array.from(longestPhraseMatch(pre, DISEASE_SYNONYMS).keys())) {
    disease.add(canon);
  }
  const methodText = stripNegatedClinicalTrialPhrases(pre);
  for (const canon of Array.from(longestPhraseMatch(methodText, METHOD_SYNONYMS).keys())) {
    method.add(canon);
  }
  for (const canon of Array.from(longestPhraseMatch(pre, TRANSLATIONAL_SYNONYMS).keys())) {
    translational.add(canon);
  }

  // Token pass: exact canonical token hits
  for (const t of tokensFrom(pre)) {
    const clean = t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
    if (SCIENCE_SET.has(clean)) science.add(clean);
    if (DISEASE_SET.has(clean)) disease.add(clean);
    if (METHOD_SET.has(clean)) method.add(clean);
    if (TRANS_SET.has(clean)) translational.add(clean);
  }

  const fallbackParts = tokensFrom(pre).filter((t) => t.length >= 4);
  const fallbackText = fallbackParts.join(" ");

  return {
    science: uniqSorted(Array.from(science)),
    disease: uniqSorted(Array.from(disease)),
    method: uniqSorted(Array.from(method)),
    translational: uniqSorted(Array.from(translational)),
    fallbackText,
  };
}

export function mergeTagBuckets(a: TagBuckets, b: TagBuckets): TagBuckets {
  return {
    science: uniqSorted([...a.science, ...b.science]),
    disease: uniqSorted([...a.disease, ...b.disease]),
    method: uniqSorted([...a.method, ...b.method]),
    translational: uniqSorted([...a.translational, ...b.translational]),
    fallbackText: [a.fallbackText, b.fallbackText].filter(Boolean).join(" "),
  };
}
