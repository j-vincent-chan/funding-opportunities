-- Watched PIs (portfolio directory) + AI-generated NOFO fit suggestions

CREATE TABLE public.tracked_pis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  department TEXT,
  research_summary TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.opportunity_pi_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities (id) ON DELETE CASCADE,
  tracked_pi_id UUID NOT NULL REFERENCES public.tracked_pis (id) ON DELETE CASCADE,
  fit_score SMALLINT NOT NULL CHECK (fit_score BETWEEN 1 AND 5),
  rationale TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, tracked_pi_id)
);

CREATE INDEX idx_tracked_pis_active ON public.tracked_pis (is_active);
CREATE INDEX idx_tracked_pis_name ON public.tracked_pis (full_name);
CREATE INDEX idx_opportunity_pi_suggestions_opp ON public.opportunity_pi_suggestions (opportunity_id);

CREATE TRIGGER tr_tracked_pis_updated_at
BEFORE UPDATE ON public.tracked_pis
FOR EACH ROW
EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.tracked_pis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_pi_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tracked_pis_all_authenticated ON public.tracked_pis
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY opportunity_pi_suggestions_all_authenticated ON public.opportunity_pi_suggestions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
