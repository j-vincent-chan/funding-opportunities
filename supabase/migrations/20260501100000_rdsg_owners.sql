-- Dedicated RDSG owner directory for Opportunity Pipeline assignment.

CREATE TABLE IF NOT EXISTS public.rdsg_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rdsg_owners_full_name_nonempty CHECK (char_length(trim(full_name)) > 0),
  CONSTRAINT rdsg_owners_email_lowercase CHECK (email IS NULL OR email = lower(email))
);

CREATE UNIQUE INDEX IF NOT EXISTS rdsg_owners_full_name_unique
  ON public.rdsg_owners (lower(trim(full_name)));

CREATE UNIQUE INDEX IF NOT EXISTS rdsg_owners_email_unique
  ON public.rdsg_owners (email)
  WHERE email IS NOT NULL;

DROP TRIGGER IF EXISTS tr_rdsg_owners_updated_at ON public.rdsg_owners;
CREATE TRIGGER tr_rdsg_owners_updated_at
  BEFORE UPDATE ON public.rdsg_owners
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.rdsg_owners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rdsg_owners_select_authenticated ON public.rdsg_owners;
CREATE POLICY rdsg_owners_select_authenticated ON public.rdsg_owners
  FOR SELECT TO authenticated
  USING (true);

-- Seed current RDSG owner roster.
INSERT INTO public.rdsg_owners (full_name, email)
VALUES
  ('Gabe Murphy, PhD', NULL),
  ('Reid Bolus, PhD', NULL)
ON CONFLICT (lower(trim(full_name))) DO NOTHING;

-- Move pipeline owner references from profiles -> rdsg_owners.
ALTER TABLE public.saved_funding_opportunities
  DROP CONSTRAINT IF EXISTS saved_funding_opportunities_owner_id_fkey;

UPDATE public.saved_funding_opportunities s
SET owner_id = NULL
WHERE owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.rdsg_owners o
    WHERE o.id = s.owner_id
  );

ALTER TABLE public.saved_funding_opportunities
  ADD CONSTRAINT saved_funding_opportunities_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.rdsg_owners (id) ON DELETE SET NULL;
