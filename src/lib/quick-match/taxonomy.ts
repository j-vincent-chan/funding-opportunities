/**
 * Quick Match taxonomy entry points.
 *
 * - **Canonical tags & phrase synonyms**: edit `src/lib/normalization/vocab-config.ts`
 *   (`SCIENCE_*`, `DISEASE_*`, `METHOD_*`, `TRANSLATIONAL_*`). Quick Match maps:
 *   - research_focal_areas ← science + translational
 *   - disease_areas ← disease
 *   - technical_expertise ← method
 *
 * - **Scoring weights**: edit `./scoring-weights.ts` (`QUICK_MATCH_WEIGHTS`).
 *
 * This file only documents the mapping; expand vocab in vocab-config for new concepts.
 */

export { QUICK_MATCH_WEIGHTS } from "./scoring-weights";
export type { QuickMatchBuckets } from "./types";
