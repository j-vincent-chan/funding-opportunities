-- Ensure IHA is a research community and add Lindsay Breithaupt to the RDSG roster.
-- Order: ImmunoX (0), IGHS (1), Diabetes Center (2), IHA (3), Other (4).

INSERT INTO public.pipeline_communities (id, slug, label, sort_order)
VALUES
  ('a1000000-0000-4000-8000-000000000005', 'iha', 'IHA', 3)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order;

UPDATE public.pipeline_communities
SET sort_order = 4
WHERE slug = 'other';

INSERT INTO public.rdsg_owners (full_name, email, is_active)
VALUES ('Lindsay Breithaupt', 'lindsay.breithaupt@gmail.com', true)
ON CONFLICT (lower(trim(full_name)))
DO UPDATE SET
  email = EXCLUDED.email,
  is_active = true,
  updated_at = now();
