-- Per-user dismissals: hide funding notices marked as not relevant.

CREATE TABLE public.dismissed_funding_opportunities (
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.funding_opportunities (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, opportunity_id)
);

CREATE INDEX idx_dismissed_funding_opportunities_user_created
  ON public.dismissed_funding_opportunities (user_id, created_at DESC);

ALTER TABLE public.dismissed_funding_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY dismissed_funding_opportunities_select_own ON public.dismissed_funding_opportunities
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY dismissed_funding_opportunities_insert_own ON public.dismissed_funding_opportunities
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY dismissed_funding_opportunities_delete_own ON public.dismissed_funding_opportunities
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.dismissed_funding_opportunities IS
  'Funding notices a user dismissed as not relevant; excluded from their search results.';
