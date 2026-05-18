-- Add IHA; keep Other as the final strip option with stable ordering.
-- Order: ImmunoX (0), IGHS (1), Diabetes Center (2), IHA (3), Other (4).

INSERT INTO public.pipeline_communities (id, slug, label, sort_order)
VALUES
  ('a1000000-0000-4000-8000-000000000005', 'iha', 'IHA', 3),
  ('a1000000-0000-4000-8000-000000000004', 'other', 'Other', 4)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order;
