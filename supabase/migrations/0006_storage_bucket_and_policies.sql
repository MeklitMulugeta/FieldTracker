-- 0006_storage_bucket_and_policies.sql
-- Private Supabase Storage bucket 'fieldtrack-evidence' and authorization policies.
-- Expected object path convention: <report_id>/<filename>

BEGIN;

-- 1. Safe private bucket creation without silently overwriting an existing bucket's configuration.
DO $$
DECLARE
  v_bucket RECORD;
  v_expected_mime_types TEXT[] := ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/pdf'
  ];
  v_expected_size_limit BIGINT := 10485760;
BEGIN
  SELECT id, name, public, file_size_limit, allowed_mime_types
  INTO v_bucket
  FROM storage.buckets
  WHERE id = 'fieldtrack-evidence'
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'fieldtrack-evidence',
      'fieldtrack-evidence',
      false,
      v_expected_size_limit,
      v_expected_mime_types
    )
    ON CONFLICT (id) DO NOTHING;
  ELSE
    IF v_bucket.public IS DISTINCT FROM false THEN
      RAISE EXCEPTION
        'Bucket fieldtrack-evidence already exists with public=%. Manual security review required; refusing to silently alter bucket visibility.',
        v_bucket.public;
    END IF;

    IF v_bucket.file_size_limit IS DISTINCT FROM v_expected_size_limit
      OR v_bucket.allowed_mime_types IS NULL
      OR NOT (
        v_bucket.allowed_mime_types @> v_expected_mime_types
        AND v_expected_mime_types @> v_bucket.allowed_mime_types
      )
    THEN
      RAISE EXCEPTION
        'Bucket fieldtrack-evidence already exists with incompatible settings (file_size_limit=%, allowed_mime_types=%). Reconcile manually before applying.',
        v_bucket.file_size_limit,
        v_bucket.allowed_mime_types;
    END IF;

    RAISE NOTICE 'Bucket fieldtrack-evidence already exists with compatible private configuration; keeping existing bucket untouched.';
  END IF;
END $$;

-- 2. View evidence: authorized report creator, assigned worker, or coordinator
CREATE POLICY fieldtrack_evidence_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'fieldtrack-evidence'
    AND public.can_access_report(
      public.try_parse_uuid((storage.foldername(name))[1]),
      auth.uid()
    )
  );

-- 3. Upload evidence: users permitted to edit the target report
CREATE POLICY fieldtrack_evidence_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'fieldtrack-evidence'
    AND auth.uid() IS NOT NULL
    AND public.can_edit_report_evidence(
      public.try_parse_uuid((storage.foldername(name))[1]),
      auth.uid()
    )
  );

-- 4. Delete evidence: coordinators, or the original uploader while the report remains editable.
--    Inspects storage.objects ownership columns (owner uuid and/or owner_id text) at migration time
--    so the policy matches the exact Supabase Storage schema version without failing or bypassing checks.
--    No UPDATE policy is granted so uploaded evidence objects cannot be silently overwritten.
DO $$
DECLARE
  v_has_owner BOOLEAN;
  v_has_owner_id BOOLEAN;
  v_ownership_expr TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'storage'
      AND table_name = 'objects'
      AND column_name = 'owner'
  ) INTO v_has_owner;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'storage'
      AND table_name = 'objects'
      AND column_name = 'owner_id'
  ) INTO v_has_owner_id;

  IF v_has_owner AND v_has_owner_id THEN
    v_ownership_expr := '(owner = auth.uid() OR owner_id = auth.uid()::text)';
  ELSIF v_has_owner THEN
    v_ownership_expr := '(owner = auth.uid())';
  ELSIF v_has_owner_id THEN
    v_ownership_expr := '(owner_id = auth.uid()::text)';
  ELSE
    RAISE EXCEPTION
      'Neither storage.objects.owner nor storage.objects.owner_id was found; manual Storage schema review required.';
  END IF;

  EXECUTE format(
    $policy$
      CREATE POLICY fieldtrack_evidence_delete
        ON storage.objects
        FOR DELETE
        TO authenticated
        USING (
          bucket_id = 'fieldtrack-evidence'
          AND (
            public.is_coordinator(auth.uid())
            OR (
              %s
              AND public.can_edit_report_evidence(
                public.try_parse_uuid((storage.foldername(name))[1]),
                auth.uid()
              )
            )
          )
        );
    $policy$,
    v_ownership_expr
  );
END $$;

COMMIT;
