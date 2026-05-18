import { QUICK_MATCH_WEIGHTS } from "./scoring-weights";
import type { PiQuickMatchProfile, QuickMatchBuckets, QuickMatchResult, QuickMatchScoreBreakdown } from "./types";
import { buildQuickMatchExplanation } from "./explain";

function intersect(a: string[], bSet: Set<string>): string[] {
  return a.filter((x) => bSet.has(x));
}

/**
 * Upper bound for raw score if the opportunity contained every PI tag (per bucket).
 */
export function maxRawScoreForPi(pi: PiQuickMatchProfile): number {
  const w = QUICK_MATCH_WEIGHTS;
  return (
    pi.researchPrimary.length * w.primaryResearch +
    pi.researchSecondary.length * w.secondaryResearch +
    pi.diseasePrimary.length * w.primaryDisease +
    pi.diseaseSecondary.length * w.secondaryDisease +
    pi.technical.length * w.technical
  );
}

export function scorePiAgainstOpportunity(
  pi: PiQuickMatchProfile,
  opp: QuickMatchBuckets
): QuickMatchResult {
  const w = QUICK_MATCH_WEIGHTS;
  const r = new Set(opp.research_focal_areas);
  const d = new Set(opp.disease_areas);
  const t = new Set(opp.technical_expertise);

  const primaryResearchHits = intersect(pi.researchPrimary, r);
  const secondaryResearchHits = intersect(pi.researchSecondary, r);
  const primaryDiseaseHits = intersect(pi.diseasePrimary, d);
  const secondaryDiseaseHits = intersect(pi.diseaseSecondary, d);
  const technicalHits = intersect(pi.technical, t);

  const rawScore =
    primaryResearchHits.length * w.primaryResearch +
    secondaryResearchHits.length * w.secondaryResearch +
    primaryDiseaseHits.length * w.primaryDisease +
    secondaryDiseaseHits.length * w.secondaryDisease +
    technicalHits.length * w.technical;

  const maxRaw = maxRawScoreForPi(pi);
  const totalScore = maxRaw <= 0 ? 0 : Math.min(100, Math.round((rawScore / maxRaw) * 100));

  const breakdown: QuickMatchScoreBreakdown = {
    primaryResearchHits,
    secondaryResearchHits,
    primaryDiseaseHits,
    secondaryDiseaseHits,
    technicalHits,
    rawScore,
    maxRaw,
  };

  return {
    totalScore,
    breakdown,
    explanation: buildQuickMatchExplanation(breakdown, totalScore),
  };
}
