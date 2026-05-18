import { normalizeTextToTags } from "@/lib/normalization/normalize-text-to-tags";
import {
  inferCollaborationComplexity,
  inferHumanSubjectsRelevance,
  inferMechanismType,
  type CollaborationComplexity,
  type HumanSubjectsRelevance,
  type MechanismType,
} from "./mechanism-heuristics";

export const OPPORTUNITY_FEATURE_VERSION = "opp-v1";

export function extractOpportunityFeatures(input: {
  title: string;
  description: string;
  category?: string | null;
  funding_instrument?: string | null;
}): {
  science_tags: string[];
  disease_tags: string[];
  method_tags: string[];
  translational_tags: string[];
  mechanism_type: MechanismType;
  collaboration_complexity: CollaborationComplexity;
  human_subjects_relevance: HumanSubjectsRelevance;
  parsed_summary: string;
  feature_version: string;
} {
  const text = [input.title, input.description, input.category, input.funding_instrument]
    .filter(Boolean)
    .join("\n");

  const buckets = normalizeTextToTags(text);
  const mechanism_type = inferMechanismType(input.title, input.description);
  const collaboration_complexity = inferCollaborationComplexity(input.title, input.description);
  const human_subjects_relevance = inferHumanSubjectsRelevance(input.title, input.description);

  const parsed_summary = [
    ...buckets.science,
    ...buckets.disease,
    ...buckets.method,
    ...buckets.translational,
  ]
    .map((t) => t.replaceAll("_", " "))
    .join("; ")
    .slice(0, 4000);

  return {
    science_tags: buckets.science,
    disease_tags: buckets.disease,
    method_tags: buckets.method,
    translational_tags: buckets.translational,
    mechanism_type,
    collaboration_complexity,
    human_subjects_relevance,
    parsed_summary: parsed_summary || buckets.fallbackText.slice(0, 4000),
    feature_version: OPPORTUNITY_FEATURE_VERSION,
  };
}
