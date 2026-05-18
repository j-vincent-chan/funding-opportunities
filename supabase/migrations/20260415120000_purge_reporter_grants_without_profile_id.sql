-- RePORTER cache is profile-id-only; remove rows tied to investigators who have no usable
-- numeric NIH Reporter PI profile id (legacy name-based ingest).

DELETE FROM public.investigator_nih_grants g
USING public.investigators i
WHERE g.investigator_id = i.id
  AND (
    i.nih_profile_id IS NULL
    OR btrim(i.nih_profile_id) = ''
    OR NULLIF(regexp_replace(i.nih_profile_id, '\D', '', 'g'), '') IS NULL
    OR (NULLIF(regexp_replace(i.nih_profile_id, '\D', '', 'g'), ''))::bigint <= 0
  );
