-- FieldTrack Development Sample Seed Script
-- Safe for local/staging development environments only.
-- Do NOT run in production with real user accounts.
--
-- Prerequisites:
--   1. Migrations 0001 through 0006 have been applied.
--   2. At least one worker and one coordinator account exist in auth.users
--      (created via Supabase Auth signup or Studio Auth UI), OR this script
--      will safely skip seeding if no profiles exist yet.

BEGIN;

DO $$
DECLARE
  v_worker_id UUID;
  v_coordinator_id UUID;
  v_report_1 UUID := '11111111-1111-4111-8111-111111111101';
  v_report_2 UUID := '11111111-1111-4111-8111-111111111102';
  v_report_3 UUID := '11111111-1111-4111-8111-111111111103';
BEGIN
  SELECT id INTO v_worker_id
  FROM public.profiles
  WHERE role = 'worker' AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT id INTO v_coordinator_id
  FROM public.profiles
  WHERE role = 'coordinator' AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_worker_id IS NULL THEN
    RAISE NOTICE 'No active worker profile found; skipping sample report seed.';
    RETURN;
  END IF;

  INSERT INTO public.reports (
    id,
    title,
    category,
    description,
    location,
    latitude,
    longitude,
    priority,
    status,
    created_by,
    client_created_at,
    idempotency_key
  )
  VALUES
    (
      v_report_1,
      'Sample: Main valve pressure fluctuation at North Pump Station',
      'Water Supply',
      'Downstream manifold gauge drops 12 PSI under peak load. Sample development record.',
      'Substation North · Bay 2',
      37.7749,
      -122.4194,
      'critical',
      'Submitted',
      v_worker_id,
      now() - interval '2 hours',
      'seed-idem-ft-0001'
    ),
    (
      v_report_2,
      'Sample: Damaged safety bollard near Loading Apron Lane 3',
      'Safety Concern',
      'Anchor stud sheared on east corner bollard. Sample development draft.',
      'Depot Yard · Lane 3',
      37.7755,
      -122.4188,
      'high',
      'Draft',
      v_worker_id,
      now() - interval '4 hours',
      'seed-idem-ft-0002'
    )
  ON CONFLICT (idempotency_key) DO NOTHING;

  IF v_coordinator_id IS NOT NULL THEN
    INSERT INTO public.reports (
      id,
      title,
      category,
      description,
      location,
      priority,
      status,
      created_by,
      assigned_to,
      assigned_by,
      client_created_at,
      idempotency_key
    )
    VALUES (
      v_report_3,
      'Sample: Conduit weatherproof boot cracked at Gate C',
      'Equipment Damage',
      'Lower elbow seal cracked after freeze; crew assigned for sleeve replacement.',
      'Perimeter Gate C · Junction 14',
      'medium',
      'Assigned',
      v_worker_id,
      v_worker_id,
      v_coordinator_id,
      now() - interval '1 day',
      'seed-idem-ft-0003'
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;
END $$;

COMMIT;
