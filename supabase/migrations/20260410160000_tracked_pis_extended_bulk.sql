
-- Extended PI fields for bulk CSV + biosketch storage

ALTER TABLE public.tracked_pis
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS middle_initial TEXT,
  ADD COLUMN IF NOT EXISTS institution TEXT,
  ADD COLUMN IF NOT EXISTS orcid TEXT,
  ADD COLUMN IF NOT EXISTS pubmed_url TEXT,
  ADD COLUMN IF NOT EXISTS reporter_profile_id TEXT,
  ADD COLUMN IF NOT EXISTS lab_website TEXT,
  ADD COLUMN IF NOT EXISTS biosketch_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS biosketch_url TEXT;

CREATE INDEX IF NOT EXISTS idx_tracked_pis_orcid ON public.tracked_pis (orcid);
CREATE INDEX IF NOT EXISTS idx_tracked_pis_email_lower ON public.tracked_pis (lower(email));

-- Private bucket for biosketch PDFs / docs (uploaded via app)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'biosketches',
  'biosketches',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "biosketches authenticated all" ON storage.objects;

CREATE POLICY "biosketches authenticated all"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'biosketches')
WITH CHECK (bucket_id = 'biosketches');