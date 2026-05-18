-- PI directory: research / disease tags (ImmunoX-style form + bulk CSV)

ALTER TABLE public.tracked_pis
  ADD COLUMN IF NOT EXISTS primary_research_area TEXT,
  ADD COLUMN IF NOT EXISTS secondary_research_areas TEXT,
  ADD COLUMN IF NOT EXISTS primary_disease_focus TEXT,
  ADD COLUMN IF NOT EXISTS secondary_disease_focuses TEXT,
  ADD COLUMN IF NOT EXISTS technological_expertise TEXT;

COMMENT ON COLUMN public.tracked_pis.primary_research_area IS 'Single primary research theme label';
COMMENT ON COLUMN public.tracked_pis.secondary_research_areas IS 'Comma/semicolon-separated secondary research themes';
COMMENT ON COLUMN public.tracked_pis.primary_disease_focus IS 'Single primary disease focus label';
COMMENT ON COLUMN public.tracked_pis.secondary_disease_focuses IS 'Comma/semicolon-separated secondary disease foci';
COMMENT ON COLUMN public.tracked_pis.technological_expertise IS 'Free-text methods / tech stack';
