-- Remove legacy PI↔NOFO match queue (replaced by in-app Quick Match).

DROP TABLE IF EXISTS public.match_feedback CASCADE;
DROP TABLE IF EXISTS public.matches CASCADE;

ALTER TABLE public.funding_opportunities
  DROP CONSTRAINT IF EXISTS funding_opportunities_match_cutoff_score_range;

ALTER TABLE public.funding_opportunities
  DROP COLUMN IF EXISTS match_cutoff_score;
