-- Four canonical research communities for triage + investigators.
-- Upserts by slug so existing FKs (saved_funding_opportunity_communities, investigators) stay valid.

INSERT INTO public.pipeline_communities (id, slug, label, sort_order)
VALUES
  ('a1000000-0000-4000-8000-000000000001', 'immunox', 'ImmunoX', 0),
  ('a1000000-0000-4000-8000-000000000002', 'ighs', 'Institute for Global Health Sciences', 1),
  ('a1000000-0000-4000-8000-000000000003', 'diabetes_center', 'Diabetes Center', 2),
  ('a1000000-0000-4000-8000-000000000004', 'other', 'Other', 3)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order;

COMMENT ON COLUMN public.investigators.research_community_id IS
  'Primary research community (ImmunoX, Institute for Global Health Sciences, Diabetes Center, Other, …).';
