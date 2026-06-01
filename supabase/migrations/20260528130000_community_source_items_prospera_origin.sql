-- Prospera-native community signals derived from PubMed / RePORTER caches (no Signal account required).

ALTER TABLE public.community_source_items
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'signal',
  ADD COLUMN IF NOT EXISTS prospera_investigator_id UUID REFERENCES public.investigators (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS prospera_cache_key TEXT;

ALTER TABLE public.community_source_items
  DROP CONSTRAINT IF EXISTS community_source_items_origin_check;

ALTER TABLE public.community_source_items
  ADD CONSTRAINT community_source_items_origin_check
  CHECK (origin IN ('signal', 'prospera'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_source_items_prospera_cache_key
  ON public.community_source_items (prospera_cache_key)
  WHERE prospera_cache_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_community_source_items_prospera_investigator
  ON public.community_source_items (prospera_investigator_id);

COMMENT ON COLUMN public.community_source_items.origin IS
  'signal = imported from Signal source_items; prospera = derived from local PubMed/RePORTER caches.';

COMMENT ON COLUMN public.community_source_items.prospera_cache_key IS
  'Stable dedupe key for Prospera-derived rows, e.g. pubmed:{investigator_id}:{pmid}.';
