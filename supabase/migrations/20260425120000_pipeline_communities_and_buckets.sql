-- Research communities (manual triage labels) + cold/archive + simplified pipeline stages

-- ---------------------------------------------------------------------------
-- pipeline_communities (curated list; extend via INSERT later)
-- ---------------------------------------------------------------------------
CREATE TABLE public.pipeline_communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.pipeline_communities (slug, label, sort_order) VALUES
  ('immunox_inflammation', 'ImmunoX & inflammation', 10),
  ('neuroscience', 'Neuroscience', 20),
  ('cancer_biology', 'Cancer biology', 30),
  ('cardiometabolic', 'Cardiometabolic', 40),
  ('population_health', 'Population health', 50),
  ('other', 'Other / cross-cutting', 60);

ALTER TABLE public.pipeline_communities ENABLE ROW LEVEL SECURITY;

CREATE POLICY pipeline_communities_select_authenticated ON public.pipeline_communities
  FOR SELECT TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- Junction: saved opportunity ↔ communities (multi-select)
-- ---------------------------------------------------------------------------
CREATE TABLE public.saved_funding_opportunity_communities (
  user_id UUID NOT NULL,
  opportunity_id UUID NOT NULL,
  community_id UUID NOT NULL REFERENCES public.pipeline_communities (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, opportunity_id, community_id),
  FOREIGN KEY (user_id, opportunity_id)
    REFERENCES public.saved_funding_opportunities (user_id, opportunity_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_saved_fo_communities_community
  ON public.saved_funding_opportunity_communities (community_id);

ALTER TABLE public.saved_funding_opportunity_communities ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_fo_communities_select_own ON public.saved_funding_opportunity_communities
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY saved_fo_communities_insert_own ON public.saved_funding_opportunity_communities
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY saved_fo_communities_delete_own ON public.saved_funding_opportunity_communities
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Cold retention + archive timestamp
-- ---------------------------------------------------------------------------
ALTER TABLE public.saved_funding_opportunities
  ADD COLUMN IF NOT EXISTS cold_until DATE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

COMMENT ON COLUMN public.saved_funding_opportunities.cold_until IS
  'When stage=cold, visibility in Cold bucket ends on this date (then archive).';

COMMENT ON COLUMN public.saved_funding_opportunities.archived_at IS
  'Set when stage=archived; optional audit timestamp.';

-- ---------------------------------------------------------------------------
-- Simplify stage to triage | monitor | cold | archived
-- ---------------------------------------------------------------------------
ALTER TABLE public.saved_funding_opportunities
  DROP CONSTRAINT IF EXISTS saved_funding_opportunities_stage_check;

UPDATE public.saved_funding_opportunities
SET stage = 'monitor'
WHERE stage IN (
  'area_match',
  'pi_shortlist',
  'strong_target',
  'outreach_sent',
  'active_development'
);

UPDATE public.saved_funding_opportunities
SET stage = 'archived',
    archived_at = COALESCE(archived_at, now())
WHERE stage IN ('closed');

UPDATE public.saved_funding_opportunities
SET stage = 'triage'
WHERE stage IS NULL
   OR stage NOT IN ('triage', 'monitor', 'cold', 'archived');

ALTER TABLE public.saved_funding_opportunities
  ADD CONSTRAINT saved_funding_opportunities_stage_check CHECK (
    stage IN ('triage', 'monitor', 'cold', 'archived')
  );

COMMENT ON COLUMN public.saved_funding_opportunities.stage IS
  'triage: categorize communities + PIs + outreach; monitor: track responses; cold: snoozed until cold_until; archived: done';

CREATE INDEX IF NOT EXISTS idx_saved_funding_opportunities_user_archived
  ON public.saved_funding_opportunities (user_id, archived_at);

CREATE INDEX IF NOT EXISTS idx_saved_funding_opportunities_cold_until
  ON public.saved_funding_opportunities (user_id, cold_until)
  WHERE stage = 'cold';

-- ---------------------------------------------------------------------------
-- Activity: allow communities_updated
-- ---------------------------------------------------------------------------
ALTER TABLE public.saved_opportunity_activity
  DROP CONSTRAINT IF EXISTS saved_opportunity_activity_event_type_check;

ALTER TABLE public.saved_opportunity_activity
  ADD CONSTRAINT saved_opportunity_activity_event_type_check CHECK (
    event_type IN (
      'stage_change',
      'note',
      'outreach_sent',
      'pi_added',
      'pi_removed',
      'pi_updated',
      'pipeline_update',
      'closure',
      'communities_updated'
    )
  );
