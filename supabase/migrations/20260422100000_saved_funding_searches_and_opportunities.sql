-- Saved Search list state + bookmarked funding notices (per user)

CREATE TABLE public.saved_funding_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_saved_funding_searches_user_created
  ON public.saved_funding_searches (user_id, created_at DESC);

CREATE TABLE public.saved_funding_opportunities (
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.funding_opportunities (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, opportunity_id)
);

CREATE INDEX idx_saved_funding_opportunities_user_created
  ON public.saved_funding_opportunities (user_id, created_at DESC);

CREATE TRIGGER tr_saved_funding_searches_updated_at
  BEFORE UPDATE ON public.saved_funding_searches
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.saved_funding_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_funding_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_funding_searches_select_own ON public.saved_funding_searches
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY saved_funding_searches_insert_own ON public.saved_funding_searches
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY saved_funding_searches_update_own ON public.saved_funding_searches
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY saved_funding_searches_delete_own ON public.saved_funding_searches
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY saved_funding_opportunities_select_own ON public.saved_funding_opportunities
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY saved_funding_opportunities_insert_own ON public.saved_funding_opportunities
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY saved_funding_opportunities_delete_own ON public.saved_funding_opportunities
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
