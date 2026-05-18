-- Award / project title from NIH RePORTER for investigator grant cache rows.

ALTER TABLE public.investigator_nih_grants
  ADD COLUMN IF NOT EXISTS project_title TEXT;

COMMENT ON COLUMN public.investigator_nih_grants.project_title IS
  'Project title from NIH RePORTER API (e.g. project_title / title).';
