import type { PiQuickMatchProfile, QuickMatchBuckets, QuickMatchResult } from "./types";
import { scorePiAgainstOpportunity } from "./score";

/** Max rows returned for Quick Match lists (most relevant first). */
export const QUICK_MATCH_TOP_N = 10;

export type RankedPiMatch = QuickMatchResult & {
  pi: PiQuickMatchProfile;
};

export type RankedOpportunityMatch = QuickMatchResult & {
  opportunityId: string;
  title: string;
  agency: string | null;
};

/**
 * Rank investigators for one opportunity’s tag set (higher score first).
 */
export function rankInvestigatorsForOpportunity(
  oppTags: QuickMatchBuckets,
  investigators: PiQuickMatchProfile[],
  topN = QUICK_MATCH_TOP_N
): RankedPiMatch[] {
  const ranked: RankedPiMatch[] = [];
  for (const pi of investigators) {
    const scored = scorePiAgainstOpportunity(pi, oppTags);
    if (scored.breakdown.rawScore <= 0) continue;
    ranked.push({ ...scored, pi });
  }
  ranked.sort((a, b) => b.totalScore - a.totalScore || b.breakdown.rawScore - a.breakdown.rawScore);
  return ranked.slice(0, topN);
}

/**
 * Rank opportunities for one PI (higher score first).
 */
export function rankOpportunitiesForPi(
  pi: PiQuickMatchProfile,
  opportunities: Array<{ id: string; title: string; agency: string | null; tags: QuickMatchBuckets }>,
  topN = QUICK_MATCH_TOP_N
): RankedOpportunityMatch[] {
  const ranked: RankedOpportunityMatch[] = [];
  for (const o of opportunities) {
    const scored = scorePiAgainstOpportunity(pi, o.tags);
    if (scored.breakdown.rawScore <= 0) continue;
    ranked.push({
      ...scored,
      opportunityId: o.id,
      title: o.title,
      agency: o.agency,
    });
  }
  ranked.sort((a, b) => b.totalScore - a.totalScore || b.breakdown.rawScore - a.breakdown.rawScore);
  return ranked.slice(0, topN);
}
