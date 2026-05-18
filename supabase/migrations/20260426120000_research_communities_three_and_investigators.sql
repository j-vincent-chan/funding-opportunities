-- Canonical research communities (ImmunoX, IGHS, Diabetes Center) + investigator link.
-- Resets pipeline_communities and per-opportunity assignments.

DELETE FROM public.saved_funding_opportunity_communities;
DELETE FROM public.pipeline_communities;

INSERT INTO public.pipeline_communities (id, slug, label, sort_order)
VALUES
  ('a1000000-0000-4000-8000-000000000001', 'immunox', 'ImmunoX', 0),
  ('a1000000-0000-4000-8000-000000000002', 'ighs', 'IGHS', 1),
  ('a1000000-0000-4000-8000-000000000003', 'diabetes_center', 'Diabetes Center', 2);

ALTER TABLE public.investigators
  ADD COLUMN IF NOT EXISTS research_community_id uuid REFERENCES public.pipeline_communities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS investigators_research_community_id_idx
  ON public.investigators (research_community_id);

COMMENT ON COLUMN public.investigators.research_community_id IS
  'Primary research community (ImmunoX, IGHS, Diabetes Center, …).';
