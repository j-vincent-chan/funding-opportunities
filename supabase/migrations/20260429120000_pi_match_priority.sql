-- Per-investigator triage priority on the opportunity pipeline (UI + workflow).
ALTER TABLE public.saved_opportunity_pi_matches
ADD COLUMN IF NOT EXISTS match_priority TEXT NOT NULL DEFAULT 'medium'
CHECK (match_priority IN ('low', 'medium', 'high'));

COMMENT ON COLUMN public.saved_opportunity_pi_matches.match_priority IS
  'Relative triage priority for this investigator on this opportunity (low / medium / high).';
