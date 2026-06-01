ALTER TABLE public.investigators
  ADD COLUMN IF NOT EXISTS middle_initial TEXT;

COMMENT ON COLUMN public.investigators.middle_initial IS
  'Middle initial from Signal import or CSV; used for strict PubMed and UCSF News name matching.';
