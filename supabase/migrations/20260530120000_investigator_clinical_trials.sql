-- ClinicalTrials.gov API v2 cache per investigator (mirrored to community_source_items on sync).

ALTER TABLE public.investigators
  ADD COLUMN IF NOT EXISTS clinicaltrials_query_override TEXT;

COMMENT ON COLUMN public.investigators.clinicaltrials_query_override IS
  'Optional ClinicalTrials.gov API v2 query.term override (search-area syntax supported).';

CREATE TABLE IF NOT EXISTS public.investigator_clinical_trials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigator_id UUID NOT NULL REFERENCES public.investigators (id) ON DELETE CASCADE,
  nct_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  overall_status TEXT,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  lead_sponsor TEXT,
  start_date DATE,
  last_update_date DATE,
  brief_summary TEXT,
  source TEXT NOT NULL DEFAULT 'clinicaltrials_api_v2',
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  match_confidence TEXT NOT NULL DEFAULT 'medium'
    CHECK (match_confidence IN ('high', 'medium', 'low')),
  provenance_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (investigator_id, nct_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_clinical_trials_inv
  ON public.investigator_clinical_trials (investigator_id);

CREATE INDEX IF NOT EXISTS idx_inv_clinical_trials_last_update
  ON public.investigator_clinical_trials (last_update_date DESC NULLS LAST);

CREATE TRIGGER tr_investigator_clinical_trials_updated_at
  BEFORE UPDATE ON public.investigator_clinical_trials
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.investigator_clinical_trials ENABLE ROW LEVEL SECURITY;

CREATE POLICY investigator_clinical_trials_all_authenticated
  ON public.investigator_clinical_trials
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.investigator_clinical_trials IS
  'Cached studies from ClinicalTrials.gov API v2 (query.term / search areas).';
