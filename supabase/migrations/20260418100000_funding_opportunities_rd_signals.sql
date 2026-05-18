-- Research-development signals for funding list filters (heuristic; not from Grants.gov UI).
-- Populated at Simpler sync and refreshed when opportunity features are extracted.

ALTER TABLE public.funding_opportunities
  ADD COLUMN IF NOT EXISTS activity_families TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS clinical_trial_mode TEXT NOT NULL DEFAULT 'unknown'
    CHECK (clinical_trial_mode IN ('unknown', 'required', 'allowed', 'not_allowed')),
  ADD COLUMN IF NOT EXISTS nih_ic_tokens TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS rd_announcement_class TEXT NOT NULL DEFAULT 'unknown'
    CHECK (rd_announcement_class IN ('unknown', 'parent_notice', 'targeted_rfa', 'nos', 'other')),
  ADD COLUMN IF NOT EXISTS rd_receipt_pattern TEXT NOT NULL DEFAULT 'unknown'
    CHECK (rd_receipt_pattern IN ('unknown', 'standard_multiple', 'single_deadline')),
  ADD COLUMN IF NOT EXISTS rd_research_pathway TEXT NOT NULL DEFAULT 'unknown'
    CHECK (
      rd_research_pathway IN (
        'unknown',
        'basic',
        'translational',
        'clinical',
        'population',
        'health_services',
        'computational',
        'mixed'
      )
    ),
  ADD COLUMN IF NOT EXISTS rd_investigator_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS rd_complexity_flags TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS rd_mechanism_type TEXT NOT NULL DEFAULT 'unknown'
    CHECK (rd_mechanism_type IN ('small_grant', 'large_grant', 'center_like', 'training', 'unknown')),
  ADD COLUMN IF NOT EXISTS rd_collaboration TEXT NOT NULL DEFAULT 'unknown'
    CHECK (rd_collaboration IN ('single_pi', 'multi_pi', 'center_like', 'unknown')),
  ADD COLUMN IF NOT EXISTS rd_human_subjects TEXT NOT NULL DEFAULT 'unknown'
    CHECK (rd_human_subjects IN ('true', 'false', 'unknown')),
  ADD COLUMN IF NOT EXISTS rd_clinical_relevance_score NUMERIC NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_funding_opps_activity_families
  ON public.funding_opportunities USING gin (activity_families);

CREATE INDEX IF NOT EXISTS idx_funding_opps_nih_ic_tokens
  ON public.funding_opportunities USING gin (nih_ic_tokens);

CREATE INDEX IF NOT EXISTS idx_funding_opps_rd_investigator_tags
  ON public.funding_opportunities USING gin (rd_investigator_tags);

CREATE INDEX IF NOT EXISTS idx_funding_opps_rd_complexity_flags
  ON public.funding_opportunities USING gin (rd_complexity_flags);

CREATE INDEX IF NOT EXISTS idx_funding_opps_rd_mechanism
  ON public.funding_opportunities (rd_mechanism_type);

CREATE INDEX IF NOT EXISTS idx_funding_opps_rd_collab
  ON public.funding_opportunities (rd_collaboration);

CREATE INDEX IF NOT EXISTS idx_funding_opps_rd_human_subjects
  ON public.funding_opportunities (rd_human_subjects);

CREATE INDEX IF NOT EXISTS idx_funding_opps_rd_clinical_score
  ON public.funding_opportunities (rd_clinical_relevance_score DESC);

COMMENT ON COLUMN public.funding_opportunities.activity_families IS
  'Heuristic NIH/NSF-style activity families (R, K, F, …) parsed from number/title/body; not official.';
COMMENT ON COLUMN public.funding_opportunities.clinical_trial_mode IS
  'Heuristic clinical-trial requirement language (Grants.gov does not expose a first-class filter).';
COMMENT ON COLUMN public.funding_opportunities.nih_ic_tokens IS
  'Detected NIH institute/center tokens (NCI, NHLBI, …) from agency and text heuristics.';
