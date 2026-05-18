-- Minimum fit score (0–1) required to persist a *suggested* match for this notice.
-- Matches prior global floor of 0.08 used in run-matching.

ALTER TABLE public.funding_opportunities
  ADD COLUMN IF NOT EXISTS match_cutoff_score NUMERIC NOT NULL DEFAULT 0.08;

ALTER TABLE public.funding_opportunities
  ADD CONSTRAINT funding_opportunities_match_cutoff_score_range
  CHECK (match_cutoff_score >= 0 AND match_cutoff_score <= 1);

COMMENT ON COLUMN public.funding_opportunities.match_cutoff_score IS
  'Suggested matches are only stored when final_score meets this minimum (0–1).';
