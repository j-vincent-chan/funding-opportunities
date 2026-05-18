-- Community intelligence: strategist engagements, cached PubMed / RePORTER rows,
-- collaboration edges, optional investigator disambiguation fields.

ALTER TABLE public.investigators
  ADD COLUMN IF NOT EXISTS orcid TEXT,
  ADD COLUMN IF NOT EXISTS pubmed_query_override TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_investigators_orcid_unique
  ON public.investigators (lower(trim(orcid)))
  WHERE orcid IS NOT NULL AND btrim(orcid) <> '';

-- ---------------------------------------------------------------------------
-- strategist_engagements (manual operational tracking; source of truth for outreach)
-- ---------------------------------------------------------------------------
CREATE TABLE public.strategist_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigator_id UUID NOT NULL REFERENCES public.investigators (id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  engagement_type TEXT NOT NULL DEFAULT 'outreach',
  opportunity_id UUID REFERENCES public.funding_opportunities (id) ON DELETE SET NULL,
  proposal_id UUID,
  status TEXT NOT NULL DEFAULT 'identified'
    CHECK (
      status IN (
        'identified',
        'matched',
        'contacted',
        'engaged',
        'drafting',
        'internal_review',
        'submitted',
        'funded',
        'declined',
        'dormant'
      )
    ),
  date_opened DATE NOT NULL DEFAULT (CURRENT_DATE),
  last_contact_date DATE,
  next_step TEXT,
  next_step_due_date DATE,
  notes TEXT,
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_strategist_engagements_inv ON public.strategist_engagements (investigator_id);
CREATE INDEX idx_strategist_engagements_owner ON public.strategist_engagements (owner_user_id);
CREATE INDEX idx_strategist_engagements_status ON public.strategist_engagements (status);
CREATE INDEX idx_strategist_engagements_opp ON public.strategist_engagements (opportunity_id);

CREATE TRIGGER tr_strategist_engagements_updated_at
  BEFORE UPDATE ON public.strategist_engagements
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- investigator_publications (PubMed cache)
-- ---------------------------------------------------------------------------
CREATE TABLE public.investigator_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigator_id UUID NOT NULL REFERENCES public.investigators (id) ON DELETE CASCADE,
  pmid TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  journal TEXT,
  publication_date DATE,
  source TEXT NOT NULL DEFAULT 'pubmed_eutils',
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  match_confidence TEXT NOT NULL DEFAULT 'medium'
    CHECK (match_confidence IN ('high', 'medium', 'low')),
  provenance_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (investigator_id, pmid)
);

CREATE INDEX idx_inv_publications_inv ON public.investigator_publications (investigator_id);
CREATE INDEX idx_inv_publications_pubdate ON public.investigator_publications (publication_date DESC NULLS LAST);

CREATE TRIGGER tr_investigator_publications_updated_at
  BEFORE UPDATE ON public.investigator_publications
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- investigator_nih_grants (NIH RePORTER cache)
-- ---------------------------------------------------------------------------
CREATE TABLE public.investigator_nih_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigator_id UUID NOT NULL REFERENCES public.investigators (id) ON DELETE CASCADE,
  project_num TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  ic_name TEXT,
  org_name TEXT,
  award_amount NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'reporter_api_v2',
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  match_confidence TEXT NOT NULL DEFAULT 'medium'
    CHECK (match_confidence IN ('high', 'medium', 'low')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (investigator_id, project_num, fiscal_year)
);

CREATE INDEX idx_inv_nih_grants_inv ON public.investigator_nih_grants (investigator_id);
CREATE INDEX idx_inv_nih_grants_fy ON public.investigator_nih_grants (fiscal_year DESC);

CREATE TRIGGER tr_investigator_nih_grants_updated_at
  BEFORE UPDATE ON public.investigator_nih_grants
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- investigator_relationships (derived collaboration signals)
-- ---------------------------------------------------------------------------
CREATE TABLE public.investigator_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigator_a_id UUID NOT NULL REFERENCES public.investigators (id) ON DELETE CASCADE,
  investigator_b_id UUID NOT NULL REFERENCES public.investigators (id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  relationship_type TEXT NOT NULL DEFAULT 'collaborator',
  strength_score NUMERIC NOT NULL DEFAULT 0,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  last_seen_date DATE,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (investigator_a_id < investigator_b_id),
  UNIQUE (investigator_a_id, investigator_b_id, source_type)
);

CREATE INDEX idx_inv_rel_a ON public.investigator_relationships (investigator_a_id);
CREATE INDEX idx_inv_rel_b ON public.investigator_relationships (investigator_b_id);

CREATE TRIGGER tr_investigator_relationships_updated_at
  BEFORE UPDATE ON public.investigator_relationships
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS (MVP: same pattern as other app tables)
-- ---------------------------------------------------------------------------
ALTER TABLE public.strategist_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigator_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigator_nih_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigator_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY strategist_engagements_all_authenticated ON public.strategist_engagements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY investigator_publications_all_authenticated ON public.investigator_publications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY investigator_nih_grants_all_authenticated ON public.investigator_nih_grants
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY investigator_relationships_all_authenticated ON public.investigator_relationships
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
