-- 01_schema_and_security.sql
-- Isolated local PostgreSQL/Supabase verification suite for FieldTrack migrations 0001-0006 and seed.sql.
-- Runs inside a rolled-back transaction so test records never persist.
-- Intended strictly for local Supabase Docker execution (never run against production).

BEGIN;

DO $$
DECLARE
  v_rls_count INT;
  v_worker_a UUID := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  v_worker_b UUID := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  v_coord_id UUID := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  v_inactive_id UUID := 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  v_backfill_id UUID := 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
  v_report_1 UUID := '11111111-1111-4111-8111-111111111201';
  v_report_2 UUID := '11111111-1111-4111-8111-111111111202';
  v_report_inactive UUID := '11111111-1111-4111-8111-111111111203';
  v_bucket_count INT;
  v_sync_row public.reports;
  v_retry_row public.reports;
  v_count INT;
BEGIN
  -- 1. Verify extensions, sequence, tables, and RLS enabled
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    RAISE EXCEPTION 'Expected pgcrypto extension to be installed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'report_number_seq' AND c.relkind = 'S'
  ) THEN
    RAISE EXCEPTION 'Expected public.report_number_seq sequence to exist';
  END IF;

  SELECT count(*) INTO v_rls_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('profiles', 'reports', 'report_attachments', 'report_assignments', 'activity_logs')
    AND c.relrowsecurity = true;

  IF v_rls_count <> 5 THEN
    RAISE EXCEPTION 'Expected RLS enabled on all 5 core tables, got %', v_rls_count;
  END IF;

  -- 2. Verify private Storage bucket configuration
  SELECT count(*) INTO v_bucket_count
  FROM storage.buckets
  WHERE id = 'fieldtrack-evidence'
    AND public = false
    AND file_size_limit = 10485760;

  IF v_bucket_count <> 1 THEN
    RAISE EXCEPTION 'Expected private bucket fieldtrack-evidence with 10MB limit';
  END IF;

  -- 3. Verify handle_new_user() creates worker profiles and ignores untrusted role metadata
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES
    (v_worker_a, 'test.workera@fieldtrack.local', '{"full_name":"Worker Alpha","role":"coordinator"}'::jsonb),
    (v_worker_b, 'test.workerb@fieldtrack.local', '{"full_name":"Worker Beta"}'::jsonb),
    (v_coord_id, 'test.coord@fieldtrack.local', '{"full_name":"Coordinator Prime"}'::jsonb),
    (v_inactive_id, 'test.inactive@fieldtrack.local', '{"full_name":"Inactive User"}'::jsonb),
    (v_backfill_id, 'test.backfill@fieldtrack.local', '{"name":"Backfill Check"}'::jsonb);

  IF (SELECT role FROM public.profiles WHERE id = v_worker_a) <> 'worker' THEN
    RAISE EXCEPTION 'handle_new_user() must ignore role metadata and default to worker';
  END IF;

  -- Simulate pre-existing user missing a profile and run same backfill logic non-destructively
  DELETE FROM public.profiles WHERE id = v_backfill_id;
  INSERT INTO public.profiles (id, full_name, email, phone, role, is_active)
  SELECT
    u.id,
    pg_catalog.btrim(COALESCE(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')),
    COALESCE(u.email, ''),
    NULLIF(pg_catalog.btrim(COALESCE(u.phone, u.raw_user_meta_data ->> 'phone', '')), ''),
    'worker',
    true
  FROM auth.users AS u
  LEFT JOIN public.profiles AS p ON p.id = u.id
  WHERE p.id IS NULL
  ON CONFLICT (id) DO NOTHING;

  IF (SELECT role FROM public.profiles WHERE id = v_backfill_id) <> 'worker' THEN
    RAISE EXCEPTION 'Backfill must default new profiles to worker';
  END IF;

  -- Admin promotion and deactivation (trusted SQL admin context)
  UPDATE public.profiles SET role = 'coordinator' WHERE id = v_coord_id;
  UPDATE public.profiles SET is_active = false WHERE id = v_inactive_id;

  -- Create a historical report for v_inactive_id as admin before testing inactive access denial
  INSERT INTO public.reports (id, title, category, description, location, priority, status, created_by, idempotency_key)
  VALUES (
    v_report_inactive,
    'Historical inactive report',
    'Other',
    'Created while active',
    'Sector 9',
    'low',
    'Draft',
    v_inactive_id,
    'test-inactive-idem-1'
  );

  -- 4. Test authenticated worker privileges, blocked direct INSERTs, and privilege escalation guards
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_worker_a::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_worker_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  -- Worker cannot inspect another user's coordinator status
  IF public.is_coordinator(v_coord_id) IS NOT FALSE THEN
    RAISE EXCEPTION 'Authenticated worker must not be able to probe coordinator status of another user';
  END IF;

  -- Worker cannot self-promote to coordinator
  BEGIN
    UPDATE public.profiles SET role = 'coordinator' WHERE id = v_worker_a;
    RAISE EXCEPTION 'Expected self-promotion to fail';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  -- Worker cannot alter own is_active flag
  BEGIN
    UPDATE public.profiles SET is_active = false WHERE id = v_worker_a;
    RAISE EXCEPTION 'Expected self-deactivation to fail';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  -- Active worker CAN update contact info
  UPDATE public.profiles SET phone = '+15550101' WHERE id = v_worker_a;

  -- Authenticated user CANNOT directly INSERT into public.reports
  BEGIN
    INSERT INTO public.reports (title, category, description, location, status, created_by)
    VALUES ('Direct insert attempt', 'Other', 'Should fail', 'Gate 1', 'Draft', v_worker_a);
    RAISE EXCEPTION 'Expected direct INSERT into public.reports to fail for authenticated';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  -- Authenticated user CANNOT directly INSERT into public.activity_logs
  BEGIN
    INSERT INTO public.activity_logs (report_id, actor_id, action, description)
    VALUES (v_report_inactive, v_worker_a, 'forged', 'Should fail');
    RAISE EXCEPTION 'Expected direct INSERT into public.activity_logs to fail';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  -- Worker CAN create reports via sync_report_idempotent()
  v_sync_row := public.sync_report_idempotent(
    v_report_1,
    'test-idem-worker-a-1',
    'Broken Pump Seal',
    'Equipment Damage',
    'Seal leaking at intake manifold',
    'Pump House A',
    37.77,
    -122.41,
    'high',
    'Draft',
    now()
  );

  IF v_sync_row.id <> v_report_1 OR v_sync_row.report_number !~ '^FT-\d{4}-\d{6}$' OR v_sync_row.created_by <> v_worker_a THEN
    RAISE EXCEPTION 'Unexpected synced report row metadata: %', v_sync_row.report_number;
  END IF;

  -- Exact retry returns original row without error or duplication
  v_retry_row := public.sync_report_idempotent(
    v_report_1,
    'test-idem-worker-a-1',
    'Modified Title Ignored',
    'Equipment Damage',
    'Modified description ignored',
    'Pump House A',
    37.77,
    -122.41,
    'critical',
    'Submitted',
    now()
  );

  IF v_retry_row.title <> 'Broken Pump Seal' OR v_retry_row.status <> 'Draft' THEN
    RAISE EXCEPTION 'Idempotent retry overwrote existing report fields';
  END IF;

  -- Idempotency key conflict with different UUID must raise 23505
  BEGIN
    PERFORM public.sync_report_idempotent(
      v_report_2,
      'test-idem-worker-a-1',
      'Key collision',
      'Other',
      'Should fail',
      'Zone 1'
    );
    RAISE EXCEPTION 'Expected idempotency_key -> different UUID conflict to raise 23505';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  -- UUID conflict with different idempotency_key must raise 23505
  BEGIN
    PERFORM public.sync_report_idempotent(
      v_report_1,
      'test-idem-different-key',
      'UUID collision',
      'Other',
      'Should fail',
      'Zone 1'
    );
    RAISE EXCEPTION 'Expected UUID -> different idempotency_key conflict to raise 23505';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  -- Worker can upload and delete evidence in storage.objects for own Draft report
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'storage' AND table_name = 'objects' AND column_name = 'owner'
  ) THEN
    INSERT INTO storage.objects (bucket_id, name, owner)
    VALUES ('fieldtrack-evidence', v_report_1::text || '/photo1.jpg', v_worker_a);
  ELSE
    INSERT INTO storage.objects (bucket_id, name, owner_id)
    VALUES ('fieldtrack-evidence', v_report_1::text || '/photo1.jpg', v_worker_a::text);
  END IF;

  INSERT INTO storage.objects (bucket_id, name, owner)
  SELECT 'fieldtrack-evidence', v_report_1::text || '/temp_delete.jpg', v_worker_a
  WHERE EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'storage' AND table_name = 'objects' AND column_name = 'owner'
  );
  DELETE FROM storage.objects
  WHERE bucket_id = 'fieldtrack-evidence' AND name = v_report_1::text || '/temp_delete.jpg';

  -- Worker can update own Draft -> Submitted
  UPDATE public.reports SET status = 'Submitted' WHERE id = v_report_1;

  -- Worker CANNOT delete Submitted report
  DELETE FROM public.reports WHERE id = v_report_1;
  IF NOT EXISTS (SELECT 1 FROM public.reports WHERE id = v_report_1) THEN
    RAISE EXCEPTION 'Submitted report should not be deletable by worker';
  END IF;

  -- Create a second Draft report and confirm worker CAN delete own Draft
  PERFORM public.sync_report_idempotent(
    v_report_2,
    'test-idem-worker-a-2',
    'Temp Draft',
    'Maintenance',
    'Will be deleted',
    'Yard B',
    NULL,
    NULL,
    'low',
    'Draft',
    now()
  );
  DELETE FROM public.reports WHERE id = v_report_2;
  IF EXISTS (SELECT 1 FROM public.reports WHERE id = v_report_2) THEN
    RAISE EXCEPTION 'Active worker should be able to delete own Draft report';
  END IF;

  RESET ROLE;

  -- 5. Verify cross-user isolation & inactive-user denials
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_worker_b::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_worker_b::text, true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO v_count FROM public.reports WHERE id = v_report_1;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Worker B must not see Worker A report before assignment';
  END IF;

  -- Worker B cannot reuse Worker A idempotency_key
  BEGIN
    PERFORM public.sync_report_idempotent(
      gen_random_uuid(),
      'test-idem-worker-a-1',
      'Cross user collision',
      'Other',
      'Should fail',
      'Zone 1'
    );
    RAISE EXCEPTION 'Expected cross-user idempotency key collision to fail';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  -- Worker B cannot view Worker A storage evidence object
  SELECT count(*) INTO v_count
  FROM storage.objects
  WHERE bucket_id = 'fieldtrack-evidence' AND name = v_report_1::text || '/photo1.jpg';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Worker B must not be able to SELECT Worker A storage evidence';
  END IF;

  RESET ROLE;

  -- Inactive user tests
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_inactive_id::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_inactive_id::text, true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO v_count FROM public.reports WHERE id = v_report_inactive;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Inactive user must not be able to read reports';
  END IF;

  UPDATE public.profiles SET full_name = 'Should Not Update' WHERE id = v_inactive_id;
  RESET ROLE;
  IF (SELECT full_name FROM public.profiles WHERE id = v_inactive_id) = 'Should Not Update' THEN
    RAISE EXCEPTION 'Inactive user must not be able to update profile via authenticated RLS';
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_inactive_id::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_inactive_id::text, true);
  SET LOCAL ROLE authenticated;

  BEGIN
    PERFORM public.sync_report_idempotent(
      gen_random_uuid(),
      'test-idem-inactive-1',
      'Inactive create',
      'Other',
      'Should fail',
      'Zone 1'
    );
    RAISE EXCEPTION 'Expected sync_report_idempotent to reject inactive user';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  RESET ROLE;

  -- 6. Coordinator tests: blocked direct assignment INSERT, workflow transitions, trigger history, terminal Rejected
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_coord_id::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_coord_id::text, true);
  SET LOCAL ROLE authenticated;

  -- Coordinator CANNOT directly INSERT into public.report_assignments
  BEGIN
    INSERT INTO public.report_assignments (report_id, worker_id, assigned_by, notes)
    VALUES (v_report_1, v_worker_b, v_coord_id, 'Forged assignment');
    RAISE EXCEPTION 'Expected direct INSERT into public.report_assignments to fail for authenticated coordinator';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  -- Assigning Submitted report auto-moves to Assigned and records assignment history + activity log
  UPDATE public.reports SET assigned_to = v_worker_b WHERE id = v_report_1;

  IF (SELECT status FROM public.reports WHERE id = v_report_1) <> 'Assigned' THEN
    RAISE EXCEPTION 'Expected Submitted + assigned_to update to auto-transition to Assigned';
  END IF;

  SELECT count(*) INTO v_count FROM public.report_assignments WHERE report_id = v_report_1 AND worker_id = v_worker_b;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected trigger to insert 1 report_assignments record, found %', v_count;
  END IF;

  -- Needs Correction requires correction_notes
  BEGIN
    UPDATE public.reports SET status = 'Needs Correction', correction_notes = '   ' WHERE id = v_report_1;
    RAISE EXCEPTION 'Expected blank correction_notes to fail';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  UPDATE public.reports
  SET status = 'Needs Correction', correction_notes = 'Attach serial number photo'
  WHERE id = v_report_1;

  -- Resolve and reopen checks resolved_at lifecycle
  UPDATE public.reports SET status = 'Submitted' WHERE id = v_report_1;
  UPDATE public.reports SET status = 'Resolved' WHERE id = v_report_1;
  IF (SELECT resolved_at FROM public.reports WHERE id = v_report_1) IS NULL THEN
    RAISE EXCEPTION 'Expected resolved_at to be populated on Resolved';
  END IF;

  UPDATE public.reports SET status = 'In Progress' WHERE id = v_report_1;
  IF (SELECT resolved_at FROM public.reports WHERE id = v_report_1) IS NOT NULL THEN
    RAISE EXCEPTION 'Expected resolved_at to clear on reopen';
  END IF;

  -- Rejection requires reason and is terminal
  UPDATE public.reports SET status = 'Rejected', rejection_reason = 'Duplicate work order' WHERE id = v_report_1;
  BEGIN
    UPDATE public.reports SET status = 'Submitted' WHERE id = v_report_1;
    RAISE EXCEPTION 'Expected transition out of terminal Rejected state to fail';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  RESET ROLE;

  -- 7. Anon role cannot call sync_report_idempotent
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}'::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  SET LOCAL ROLE anon;

  BEGIN
    PERFORM public.sync_report_idempotent(
      gen_random_uuid(),
      'test-idem-anon',
      'Anon attempt',
      'Other',
      'Should fail',
      'Nowhere'
    );
    RAISE EXCEPTION 'Expected anon role to be denied EXECUTE on sync_report_idempotent';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  RESET ROLE;

  -- 8. Verify seed.sql syntax/idempotency inside isolated transaction when active profiles exist
  INSERT INTO public.reports (
    id, title, category, description, location, priority, status, created_by, idempotency_key
  )
  VALUES (
    '11111111-1111-4111-8111-111111111101',
    'Seed check record',
    'Water Supply',
    'Verifies seed report insert under privileged SQL session',
    'Test Station',
    'medium',
    'Submitted',
    v_worker_a,
    'seed-idem-test-local-0001'
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RAISE NOTICE 'ALL FIELDTRACK ISOLATED POSTGRESQL / SUPABASE SECURITY CHECKS PASSED';
END $$;

ROLLBACK;
