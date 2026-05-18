-- Link investigators to a primary research community (optional FK to pipeline_communities).
-- Safe if already applied via 20260426120000_research_communities_three_and_investigators.sql.

ALTER TABLE public.investigators
  ADD COLUMN IF NOT EXISTS research_community_id uuid REFERENCES public.pipeline_communities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS investigators_research_community_id_idx
  ON public.investigators (research_community_id);

COMMENT ON COLUMN public.investigators.research_community_id IS
  'Primary research community (ImmunoX, Institute for Global Health Sciences, Diabetes Center, Other, …).';
