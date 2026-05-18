/**
 * Per-tag overlap weights (same weight for each matching canonical tag in that bucket).
 * Tune here to emphasize disease vs method vs research focus.
 */
export const QUICK_MATCH_WEIGHTS = {
  /** Overlap with PI primary research / focal text */
  primaryResearch: 3,
  /** Overlap with PI secondary research + stored science/translational features */
  secondaryResearch: 2,
  /** Overlap with PI primary disease text */
  primaryDisease: 3,
  /** Overlap with PI secondary disease + stored disease tags */
  secondaryDisease: 2,
  /** Overlap with PI technical expertise + method tags */
  technical: 2,
} as const;
