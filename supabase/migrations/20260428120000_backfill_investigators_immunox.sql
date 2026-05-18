-- Set all existing investigators' primary research community to ImmunoX.
-- Resolves the community id by slug so it works across environments.

UPDATE public.investigators i
SET research_community_id = pc.id
FROM public.pipeline_communities pc
WHERE pc.slug = 'immunox';
