-- Ensure authenticated app users can read/write community signal tables (not only service_role).

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_source_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_source_item_entities TO authenticated;

GRANT ALL ON public.community_source_items TO service_role;
GRANT ALL ON public.community_source_item_entities TO service_role;
