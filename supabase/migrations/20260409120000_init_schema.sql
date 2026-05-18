-- Pursuit Queue — initial schema
-- Requires: pgcrypto (gen_random_uuid)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- opportunities (normalized Grants.gov)
-- ---------------------------------------------------------------------------
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grants_gov_id TEXT NOT NULL UNIQUE,
  opportunity_number TEXT,
  title TEXT NOT NULL,
  agency_name TEXT,
  agency_code TEXT,
  cfda_numbers TEXT,
  category TEXT,
  funding_instrument TEXT,
  posted_date DATE,
  close_date DATE,
  eligibility_summary TEXT,
  synopsis TEXT,
  source_url TEXT,
  raw_search_hit JSONB,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- pursuit_records (internal workflow; one per opportunity)
-- ---------------------------------------------------------------------------
CREATE TABLE public.pursuit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL UNIQUE REFERENCES public.opportunities (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (
    status IN ('new', 'under_review', 'pursue', 'decline', 'handed_off')
  ),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  owner_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  strategic_fit_score SMALLINT CHECK (strategic_fit_score BETWEEN 1 AND 5),
  competitiveness_score SMALLINT CHECK (competitiveness_score BETWEEN 1 AND 5),
  readiness_score SMALLINT CHECK (readiness_score BETWEEN 1 AND 5),
  notes TEXT,
  rationale TEXT,
  internal_next_step TEXT,
  internal_due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- tags
-- ---------------------------------------------------------------------------
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.opportunity_tags (
  opportunity_id UUID NOT NULL REFERENCES public.opportunities (id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags (id) ON DELETE CASCADE,
  PRIMARY KEY (opportunity_id, tag_id)
);

-- ---------------------------------------------------------------------------
-- watchlists
-- ---------------------------------------------------------------------------
CREATE TABLE public.watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.watchlist_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id UUID NOT NULL REFERENCES public.watchlists (id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (
    rule_type IN ('keyword', 'agency', 'category', 'funding_instrument')
  ),
  value TEXT NOT NULL
);

CREATE TABLE public.opportunity_watchlist_matches (
  opportunity_id UUID NOT NULL REFERENCES public.opportunities (id) ON DELETE CASCADE,
  watchlist_id UUID NOT NULL REFERENCES public.watchlists (id) ON DELETE CASCADE,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (opportunity_id, watchlist_id)
);

-- ---------------------------------------------------------------------------
-- activity_log (audit trail)
-- ---------------------------------------------------------------------------
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('opportunity', 'pursuit_record')),
  entity_id UUID NOT NULL,
  user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_opportunities_close_date ON public.opportunities (close_date);
CREATE INDEX idx_opportunities_agency_code ON public.opportunities (agency_code);
CREATE INDEX idx_opportunities_posted_date ON public.opportunities (posted_date DESC NULLS LAST);
CREATE INDEX idx_pursuit_records_owner ON public.pursuit_records (owner_id);
CREATE INDEX idx_pursuit_records_status ON public.pursuit_records (status);
CREATE INDEX idx_activity_log_entity ON public.activity_log (entity_type, entity_id);
CREATE INDEX idx_watchlist_rules_watchlist ON public.watchlist_rules (watchlist_id);

-- ---------------------------------------------------------------------------
-- RPC: opportunities with no pursuit record (for filters)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.opportunity_ids_without_pursuit()
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT o.id
  FROM public.opportunities o
  LEFT JOIN public.pursuit_records p ON p.opportunity_id = o.id
  WHERE p.id IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.opportunity_ids_without_pursuit() TO authenticated;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER tr_opportunities_updated_at
BEFORE UPDATE ON public.opportunities
FOR EACH ROW
EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER tr_pursuit_records_updated_at
BEFORE UPDATE ON public.pursuit_records
FOR EACH ROW
EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER tr_watchlists_updated_at
BEFORE UPDATE ON public.watchlists
FOR EACH ROW
EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- auth: auto-create profile
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'staff')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pursuit_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_watchlist_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_authenticated ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY opportunities_all_authenticated ON public.opportunities
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY pursuit_records_all_authenticated ON public.pursuit_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY tags_all_authenticated ON public.tags
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY opportunity_tags_all_authenticated ON public.opportunity_tags
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY watchlists_all_authenticated ON public.watchlists
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY watchlist_rules_all_authenticated ON public.watchlist_rules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY opportunity_watchlist_matches_all_authenticated ON public.opportunity_watchlist_matches
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY activity_log_all_authenticated ON public.activity_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
