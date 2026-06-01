-- Cached Signal source_items (curated research signals) for the Community dashboard.

CREATE TABLE public.community_source_items (
  id UUID PRIMARY KEY,
  signal_community_id UUID,
  title TEXT NOT NULL DEFAULT '',
  category TEXT,
  source_type TEXT,
  status TEXT,
  published_at TIMESTAMPTZ,
  found_at TIMESTAMPTZ,
  source_url TEXT,
  source_domain TEXT,
  signal_group_key TEXT,
  raw_text TEXT,
  raw_summary TEXT,
  nih_project_num TEXT,
  signal_tracked_entity_id UUID,
  signal_created_at TIMESTAMPTZ,
  signal_updated_at TIMESTAMPTZ,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_community_source_items_community
  ON public.community_source_items (signal_community_id);

CREATE INDEX idx_community_source_items_published
  ON public.community_source_items (published_at DESC NULLS LAST);

CREATE INDEX idx_community_source_items_found
  ON public.community_source_items (found_at DESC NULLS LAST);

CREATE INDEX idx_community_source_items_category
  ON public.community_source_items (category);

CREATE INDEX idx_community_source_items_entity
  ON public.community_source_items (signal_tracked_entity_id);

CREATE TABLE public.community_source_item_entities (
  source_item_id UUID NOT NULL REFERENCES public.community_source_items (id) ON DELETE CASCADE,
  signal_entity_id UUID NOT NULL,
  signal_link_created_at TIMESTAMPTZ,
  PRIMARY KEY (source_item_id, signal_entity_id)
);

CREATE INDEX idx_community_source_item_entities_entity
  ON public.community_source_item_entities (signal_entity_id);

CREATE TRIGGER tr_community_source_items_updated_at
  BEFORE UPDATE ON public.community_source_items
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.community_source_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_source_item_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY community_source_items_all_authenticated ON public.community_source_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY community_source_item_entities_all_authenticated ON public.community_source_item_entities
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.community_source_items IS
  'Imported Signal source_items rows powering the Community dashboard.';

COMMENT ON TABLE public.community_source_item_entities IS
  'Many-to-many links between Signal source_items and tracked_entities.';
