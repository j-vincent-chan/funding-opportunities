import { mergeTagBuckets, normalizeTextToTags, preprocessText } from "@/lib/normalization/normalize-text-to-tags";
import type { TagBuckets } from "@/lib/normalization/normalize-text-to-tags";
import { coercePlainTextFromUnknown } from "@/lib/formatting/coerce-plain-text";
import type { QuickMatchBuckets } from "./types";

function uniqSorted(arr: string[]): string[] {
  return Array.from(new Set(arr)).sort();
}

const EMPTY_BUCKETS: TagBuckets = {
  science: [],
  disease: [],
  method: [],
  translational: [],
  fallbackText: "",
};

function toQuickMatch(b: TagBuckets): QuickMatchBuckets {
  return {
    research_focal_areas: uniqSorted([...b.science, ...b.translational]),
    disease_areas: uniqSorted(b.disease),
    technical_expertise: uniqSorted(b.method),
  };
}

/**
 * Concatenate opportunity text sources and derive Quick Match tags (deterministic, no LLM).
 */
export function extractOpportunityQuickTags(input: {
  title: string;
  description?: string | null;
  agency?: string | null;
  agency_code?: string | null;
  category?: string | null;
  funding_instrument?: string | null;
  applicant_types?: unknown;
  raw_payload_json?: unknown;
}): QuickMatchBuckets {
  const chunks: string[] = [input.title];
  if (input.description) chunks.push(String(input.description));
  if (input.agency) chunks.push(String(input.agency));
  if (input.agency_code) chunks.push(String(input.agency_code));
  if (input.category) chunks.push(String(input.category));
  if (input.funding_instrument) chunks.push(String(input.funding_instrument));
  const at = input.applicant_types;
  if (Array.isArray(at)) chunks.push(at.map((x) => String(x)).join(" "));
  else chunks.push(coercePlainTextFromUnknown(at));

  const raw = input.raw_payload_json;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    for (const key of ["summary", "eligibility", "agency_name", "opportunity_title"]) {
      const v = o[key];
      if (typeof v === "string" && v.trim()) chunks.push(v);
      else if (v && typeof v === "object") chunks.push(JSON.stringify(v).slice(0, 4000));
    }
  }

  let acc = EMPTY_BUCKETS;
  for (const chunk of chunks) {
    if (!preprocessText(chunk)) continue;
    acc = mergeTagBuckets(acc, normalizeTextToTags(chunk));
  }

  return toQuickMatch(acc);
}
