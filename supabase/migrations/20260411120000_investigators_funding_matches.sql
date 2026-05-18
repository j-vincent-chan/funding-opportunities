-- Investigators (ImmunoX / fit engine), Simpler.Grants.gov funding opportunities,
-- feature tables, deterministic matches, feedback, and sync logs.
-- Preserves existing opportunities / tracked_pis / pursuit workflow.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- investigators
-- ---------------------------------------------------------------------------
CREATE TABLE public.investigators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  full_name TEXT NOT NULL,
  email TEXT,
  home_department TEXT,
  division TEXT,
  rank TEXT,
  affiliations JSONB NOT NULL DEFAULT '[]'::jsonb,
  nih_profile_id TEXT,
  raw_profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_investigators_email_lower_unique
  ON public.investigators (lower(trim(email)))
  WHERE email IS NOT NULL AND btrim(email) <> '';

CREATE INDEX idx_investigators_nih_profile_id
  ON public.investigators (nih_profile_id)
  WHERE nih_profile_id IS NOT NULL;

CREATE INDEX idx_investigators_full_name_trgm
  ON public.investigators USING gin (full_name gin_trgm_ops);

CREATE TRIGGER tr_investigators_updated_at
  BEFORE UPDATE ON public.investigators
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- investigator_profile_features
-- ---------------------------------------------------------------------------
CREATE TABLE public.investigator_profile_features (
  investigator_id UUID PRIMARY KEY REFERENCES public.investigators (id) ON DELETE CASCADE,
  science_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  disease_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  method_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  translational_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  grant_readiness_small TEXT NOT NULL DEFAULT 'unknown',
  grant_readiness_large TEXT NOT NULL DEFAULT 'unknown',
  collaboration_role_preference TEXT NOT NULL DEFAULT 'unknown'
    CHECK (collaboration_role_preference IN ('lead', 'collaborator', 'either', 'unknown')),
  profile_summary_normalized TEXT NOT NULL DEFAULT '',
  normalization_version TEXT NOT NULL DEFAULT 'v1',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inv_profile_features_science ON public.investigator_profile_features USING gin (science_tags);
CREATE INDEX idx_inv_profile_features_disease ON public.investigator_profile_features USING gin (disease_tags);
CREATE INDEX idx_inv_profile_features_method ON public.investigator_profile_features USING gin (method_tags);
CREATE INDEX idx_inv_profile_features_trans ON public.investigator_profile_features USING gin (translational_tags);

CREATE TRIGGER tr_investigator_profile_features_updated_at
  BEFORE UPDATE ON public.investigator_profile_features
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- funding_opportunities (Simpler.Grants.gov and future sources)
-- ---------------------------------------------------------------------------
CREATE TABLE public.funding_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system TEXT NOT NULL DEFAULT 'simpler_grants',
  source_opportunity_id TEXT NOT NULL,
  opportunity_number TEXT,
  title TEXT NOT NULL,
  agency TEXT,
  agency_code TEXT,
  posted_date DATE,
  close_date DATE,
  forecasted BOOLEAN NOT NULL DEFAULT false,
  status TEXT,
  funding_instrument TEXT,
  category TEXT,
  applicant_types JSONB,
  award_floor NUMERIC,
  award_ceiling NUMERIC,
  description TEXT,
  raw_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  nih_bias_score NUMERIC NOT NULL DEFAULT 0,
  is_nih_relevant BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_system, source_opportunity_id)
);

CREATE INDEX idx_funding_opps_close_date ON public.funding_opportunities (close_date);
CREATE INDEX idx_funding_opps_posted_date ON public.funding_opportunities (posted_date DESC NULLS LAST);
CREATE INDEX idx_funding_opps_status ON public.funding_opportunities (status);
CREATE INDEX idx_funding_opps_nih ON public.funding_opportunities (is_nih_relevant, status);
CREATE INDEX idx_funding_opps_agency_code ON public.funding_opportunities (agency_code);
CREATE INDEX idx_funding_opps_final_score_helper ON public.funding_opportunities (is_nih_relevant, close_date, status);

CREATE TRIGGER tr_funding_opportunities_updated_at
  BEFORE UPDATE ON public.funding_opportunities
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- opportunity_features
-- ---------------------------------------------------------------------------
CREATE TABLE public.opportunity_features (
  opportunity_id UUID PRIMARY KEY REFERENCES public.funding_opportunities (id) ON DELETE CASCADE,
  science_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  disease_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  method_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  translational_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  mechanism_type TEXT NOT NULL DEFAULT 'unknown'
    CHECK (mechanism_type IN ('small_grant', 'large_grant', 'center_like', 'training', 'unknown')),
  collaboration_complexity TEXT NOT NULL DEFAULT 'unknown'
    CHECK (collaboration_complexity IN ('single_pi', 'multi_pi', 'center_like', 'unknown')),
  human_subjects_relevance TEXT NOT NULL DEFAULT 'unknown'
    CHECK (human_subjects_relevance IN ('true', 'false', 'unknown')),
  clinical_relevance_score NUMERIC NOT NULL DEFAULT 0,
  parsed_summary TEXT NOT NULL DEFAULT '',
  feature_version TEXT NOT NULL DEFAULT 'v1',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_opp_features_science ON public.opportunity_features USING gin (science_tags);
CREATE INDEX idx_opp_features_disease ON public.opportunity_features USING gin (disease_tags);
CREATE INDEX idx_opp_features_method ON public.opportunity_features USING gin (method_tags);
CREATE INDEX idx_opp_features_trans ON public.opportunity_features USING gin (translational_tags);

CREATE TRIGGER tr_opportunity_features_updated_at
  BEFORE UPDATE ON public.opportunity_features
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- matches (PI ↔ funding opportunity fit rows)
-- ---------------------------------------------------------------------------
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigator_id UUID NOT NULL REFERENCES public.investigators (id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.funding_opportunities (id) ON DELETE CASCADE,
  retrieval_score NUMERIC NOT NULL DEFAULT 0,
  rerank_score NUMERIC NOT NULL DEFAULT 0,
  final_score NUMERIC NOT NULL DEFAULT 0,
  science_fit_score NUMERIC NOT NULL DEFAULT 0,
  disease_fit_score NUMERIC NOT NULL DEFAULT 0,
  method_fit_score NUMERIC NOT NULL DEFAULT 0,
  translational_fit_score NUMERIC NOT NULL DEFAULT 0,
  mechanism_fit_score NUMERIC NOT NULL DEFAULT 0,
  strategy_fit_score NUMERIC NOT NULL DEFAULT 0,
  explanation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  explanation_text TEXT NOT NULL DEFAULT '',
  match_status TEXT NOT NULL DEFAULT 'suggested'
    CHECK (match_status IN ('suggested', 'approved', 'rejected', 'hidden')),
  reviewer_notes TEXT,
  scoring_version TEXT NOT NULL DEFAULT 'match-v1',
  manual_score_delta NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (investigator_id, opportunity_id)
);

CREATE INDEX idx_matches_investigator ON public.matches (investigator_id);
CREATE INDEX idx_matches_opportunity ON public.matches (opportunity_id);
CREATE INDEX idx_matches_final_desc ON public.matches (final_score DESC);
CREATE INDEX idx_matches_status ON public.matches (match_status);

CREATE TRIGGER tr_matches_updated_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- match_feedback
-- ---------------------------------------------------------------------------
CREATE TABLE public.match_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
  reviewer_user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL
    CHECK (feedback_type IN ('approve', 'reject', 'boost', 'suppress', 'note')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_match_feedback_match ON public.match_feedback (match_id);
CREATE INDEX idx_match_feedback_reviewer ON public.match_feedback (reviewer_user_id);

-- ---------------------------------------------------------------------------
-- sync_job_logs (admin diagnostics)
-- ---------------------------------------------------------------------------
CREATE TABLE public.sync_job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'success', 'error')),
  message TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX idx_sync_job_logs_type_started ON public.sync_job_logs (job_type, started_at DESC);

-- ---------------------------------------------------------------------------
-- RLS (same MVP pattern: authenticated full access)
-- ---------------------------------------------------------------------------
ALTER TABLE public.investigators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigator_profile_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_job_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY investigators_all_authenticated ON public.investigators
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY investigator_profile_features_all_authenticated ON public.investigator_profile_features
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY funding_opportunities_all_authenticated ON public.funding_opportunities
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY opportunity_features_all_authenticated ON public.opportunity_features
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY matches_all_authenticated ON public.matches
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY match_feedback_all_authenticated ON public.match_feedback
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY sync_job_logs_all_authenticated ON public.sync_job_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
