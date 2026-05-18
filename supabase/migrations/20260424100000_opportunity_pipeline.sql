-- Opportunity pipeline: extend saved notices with RDSG workflow + PI matches + activity log

-- ---------------------------------------------------------------------------
-- saved_funding_opportunities: pipeline fields (legacy rows get defaults)
-- ---------------------------------------------------------------------------
ALTER TABLE public.saved_funding_opportunities
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'triage',
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS fit_confidence TEXT NOT NULL DEFAULT 'plausible',
  ADD COLUMN IF NOT EXISTS strategic_value TEXT NOT NULL DEFAULT 'useful',
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS why_matters TEXT,
  ADD COLUMN IF NOT EXISTS risks_barriers TEXT,
  ADD COLUMN IF NOT EXISTS area_program_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS next_action_date DATE,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS closure_reason TEXT,
  ADD COLUMN IF NOT EXISTS outreach_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_outreach_at TIMESTAMPTZ;

UPDATE public.saved_funding_opportunities
SET last_activity_at = created_at;

COMMENT ON COLUMN public.saved_funding_opportunities.stage IS
  'Pipeline: triage | monitor | area_match | pi_shortlist | strong_target | outreach_sent | active_development | closed';

ALTER TABLE public.saved_funding_opportunities
  DROP CONSTRAINT IF EXISTS saved_funding_opportunities_stage_check,
  ADD CONSTRAINT saved_funding_opportunities_stage_check CHECK (
    stage IN (
      'triage',
      'monitor',
      'area_match',
      'pi_shortlist',
      'strong_target',
      'outreach_sent',
      'active_development',
      'closed'
    )
  );

ALTER TABLE public.saved_funding_opportunities
  DROP CONSTRAINT IF EXISTS saved_funding_opportunities_priority_check,
  ADD CONSTRAINT saved_funding_opportunities_priority_check CHECK (
    priority IN ('low', 'medium', 'high', 'urgent')
  );

ALTER TABLE public.saved_funding_opportunities
  DROP CONSTRAINT IF EXISTS saved_funding_opportunities_fit_confidence_check,
  ADD CONSTRAINT saved_funding_opportunities_fit_confidence_check CHECK (
    fit_confidence IN ('weak', 'plausible', 'strong')
  );

ALTER TABLE public.saved_funding_opportunities
  DROP CONSTRAINT IF EXISTS saved_funding_opportunities_strategic_value_check,
  ADD CONSTRAINT saved_funding_opportunities_strategic_value_check CHECK (
    strategic_value IN ('opportunistic', 'useful', 'strategic', 'highly_strategic')
  );

ALTER TABLE public.saved_funding_opportunities
  DROP CONSTRAINT IF EXISTS saved_funding_opportunities_closure_reason_check,
  ADD CONSTRAINT saved_funding_opportunities_closure_reason_check CHECK (
    closure_reason IS NULL
    OR closure_reason IN (
      'submitted',
      'declined',
      'deferred',
      'not_competitive',
      'missed_timing',
      'archived',
      'other'
    )
  );

CREATE INDEX IF NOT EXISTS idx_saved_funding_opportunities_user_stage
  ON public.saved_funding_opportunities (user_id, stage);

CREATE INDEX IF NOT EXISTS idx_saved_funding_opportunities_user_next_action
  ON public.saved_funding_opportunities (user_id, next_action_date);

CREATE INDEX IF NOT EXISTS idx_saved_funding_opportunities_user_owner
  ON public.saved_funding_opportunities (user_id, owner_id);

DROP TRIGGER IF EXISTS tr_saved_funding_opportunities_updated_at ON public.saved_funding_opportunities;
CREATE TRIGGER tr_saved_funding_opportunities_updated_at
  BEFORE UPDATE ON public.saved_funding_opportunities
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

CREATE POLICY saved_funding_opportunities_update_own ON public.saved_funding_opportunities
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Matched PIs (manual-first; references real investigators)
-- ---------------------------------------------------------------------------
CREATE TABLE public.saved_opportunity_pi_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  opportunity_id UUID NOT NULL,
  investigator_id UUID NOT NULL REFERENCES public.investigators (id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  match_strength TEXT NOT NULL DEFAULT 'plausible' CHECK (
    match_strength IN ('stretch', 'plausible', 'strong')
  ),
  rationale TEXT,
  role_suggestion TEXT NOT NULL DEFAULT 'primary' CHECK (
    role_suggestion IN ('primary', 'collaborator', 'co_pi', 'mpi_candidate')
  ),
  outreach_status TEXT NOT NULL DEFAULT 'not_contacted' CHECK (
    outreach_status IN (
      'not_contacted',
      'drafted',
      'sent',
      'responded_interested',
      'responded_maybe',
      'responded_declined'
    )
  ),
  notes TEXT,
  is_primary_target BOOLEAN NOT NULL DEFAULT false,
  follow_up_date DATE,
  outreach_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, opportunity_id, investigator_id),
  FOREIGN KEY (user_id, opportunity_id)
    REFERENCES public.saved_funding_opportunities (user_id, opportunity_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_saved_opportunity_pi_matches_user_opp
  ON public.saved_opportunity_pi_matches (user_id, opportunity_id);

CREATE INDEX idx_saved_opportunity_pi_matches_investigator
  ON public.saved_opportunity_pi_matches (investigator_id);

CREATE TRIGGER tr_saved_opportunity_pi_matches_updated_at
  BEFORE UPDATE ON public.saved_opportunity_pi_matches
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.saved_opportunity_pi_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_opportunity_pi_matches_select_own ON public.saved_opportunity_pi_matches
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY saved_opportunity_pi_matches_insert_own ON public.saved_opportunity_pi_matches
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY saved_opportunity_pi_matches_update_own ON public.saved_opportunity_pi_matches
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY saved_opportunity_pi_matches_delete_own ON public.saved_opportunity_pi_matches
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Activity / timeline (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE public.saved_opportunity_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  opportunity_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'stage_change',
      'note',
      'outreach_sent',
      'pi_added',
      'pi_removed',
      'pi_updated',
      'pipeline_update',
      'closure'
    )
  ),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  FOREIGN KEY (user_id, opportunity_id)
    REFERENCES public.saved_funding_opportunities (user_id, opportunity_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_saved_opportunity_activity_user_opp_created
  ON public.saved_opportunity_activity (user_id, opportunity_id, created_at DESC);

ALTER TABLE public.saved_opportunity_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_opportunity_activity_select_own ON public.saved_opportunity_activity
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY saved_opportunity_activity_insert_own ON public.saved_opportunity_activity
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
