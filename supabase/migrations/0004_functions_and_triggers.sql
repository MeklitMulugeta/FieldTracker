-- 0004_functions_and_triggers.sql
-- Database functions, security guards, lifecycle triggers, backfill, and idempotent offline sync RPC.

BEGIN;

-- 1. Generic updated_at maintenance trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

-- 2. Safe UUID parser for Storage object path validation
CREATE OR REPLACE FUNCTION public.try_parse_uuid(input_text TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF input_text IS NULL OR pg_catalog.btrim(input_text) = '' THEN
    RETURN NULL;
  END IF;
  RETURN input_text::UUID;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$$;

-- 3. Non-recursive RLS helper functions (SECURITY DEFINER with safe search_path).
--    Ordinary authenticated callers can only inspect their own permissions (p_user_id = auth.uid());
--    trusted service_role or SQL admin sessions (auth.uid() IS NULL) may query any target user ID.
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
      AND p.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.role
  FROM public.profiles AS p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_coordinator(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p_user_id IS NOT NULL
    AND (
      auth.uid() IS NULL
      OR COALESCE(auth.role(), '') = 'service_role'
      OR p_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = p_user_id
        AND p.role = 'coordinator'
        AND p.is_active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_report(
  p_report_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p_user_id IS NOT NULL
    AND p_report_id IS NOT NULL
    AND (
      auth.uid() IS NULL
      OR COALESCE(auth.role(), '') = 'service_role'
      OR p_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = p_user_id
        AND p.is_active = true
    )
    AND (
      public.is_coordinator(p_user_id)
      OR EXISTS (
        SELECT 1
        FROM public.reports AS r
        WHERE r.id = p_report_id
          AND (r.created_by = p_user_id OR r.assigned_to = p_user_id)
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_report_evidence(
  p_report_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p_user_id IS NOT NULL
    AND p_report_id IS NOT NULL
    AND (
      auth.uid() IS NULL
      OR COALESCE(auth.role(), '') = 'service_role'
      OR p_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = p_user_id
        AND p.is_active = true
    )
    AND (
      public.is_coordinator(p_user_id)
      OR EXISTS (
        SELECT 1
        FROM public.reports AS r
        WHERE r.id = p_report_id
          AND (
            (r.created_by = p_user_id AND r.status IN ('Draft', 'Needs Correction'))
            OR (r.assigned_to = p_user_id AND r.status IN ('Assigned', 'In Progress'))
          )
      )
    );
$$;

-- 4. Automatically create a worker profile on auth.users signup.
--    Always enforces default role = 'worker', ignoring any untrusted signup metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  derived_name TEXT;
BEGIN
  derived_name := pg_catalog.btrim(
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      ''
    )
  );

  INSERT INTO public.profiles (id, full_name, email, phone, role, is_active)
  VALUES (
    NEW.id,
    derived_name,
    COALESCE(NEW.email, ''),
    NULLIF(pg_catalog.btrim(COALESCE(NEW.phone, NEW.raw_user_meta_data ->> 'phone', '')), ''),
    'worker',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 5. Protect coordinator role privileges against self-promotion
CREATE OR REPLACE FUNCTION public.protect_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  jwt_role TEXT := COALESCE(auth.role(), '');
  caller_id UUID := auth.uid();
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Profile id cannot be modified'
      USING ERRCODE = '42501';
  END IF;

  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active) THEN
    -- Only trusted administrative contexts (service_role or SQL admin session where auth.uid() IS NULL)
    -- may grant/revoke coordinator privileges or change active status.
    IF caller_id IS NOT NULL AND jwt_role <> 'service_role' THEN
      RAISE EXCEPTION 'Only a trusted administrative process may modify role or activation status'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 6. Automatically generate collision-free FieldTrack report numbers (e.g. FT-2026-000001)
CREATE OR REPLACE FUNCTION public.generate_report_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  seq_val BIGINT;
  report_year INT;
BEGIN
  seq_val := pg_catalog.nextval('public.report_number_seq');
  report_year := EXTRACT(YEAR FROM COALESCE(NEW.created_at, pg_catalog.now()))::INT;

  NEW.report_number := pg_catalog.format(
    'FT-%s-%s',
    report_year,
    pg_catalog.lpad(seq_val::TEXT, 6, '0')
  );

  IF NEW.status = 'Submitted' AND NEW.submitted_at IS NULL THEN
    NEW.submitted_at := pg_catalog.now();
  END IF;

  RETURN NEW;
END;
$$;

-- 7. Enforce report workflow transitions and role-based mutations
CREATE OR REPLACE FUNCTION public.enforce_report_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID := auth.uid();
  jwt_role TEXT := COALESCE(auth.role(), '');
  is_trusted_admin BOOLEAN := (caller_id IS NULL OR jwt_role = 'service_role');
  caller_is_coord BOOLEAN := (is_trusted_admin OR public.is_coordinator(caller_id));
  transition_allowed BOOLEAN := false;
BEGIN
  -- Immutable identity & offline-sync metadata
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.report_number IS DISTINCT FROM OLD.report_number
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR (OLD.idempotency_key IS NOT NULL AND NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key)
  THEN
    RAISE EXCEPTION 'Immutable report attributes cannot be modified'
      USING ERRCODE = '42501';
  END IF;

  -- Automatically move Submitted -> Assigned when a coordinator assigns a worker
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    IF NOT caller_is_coord THEN
      RAISE EXCEPTION 'Only coordinators may assign reports'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.assigned_by IS NULL THEN
      NEW.assigned_by := caller_id;
    END IF;

    IF OLD.status = 'Submitted' AND NEW.status = 'Submitted' THEN
      NEW.status := 'Assigned';
    END IF;
  END IF;

  -- Prevent workers from assigning or modifying coordinator review metadata
  IF NOT caller_is_coord AND (
    NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
    OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
    OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
    OR NEW.correction_notes IS DISTINCT FROM OLD.correction_notes
    OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at
  ) THEN
    RAISE EXCEPTION 'Workers cannot modify report assignments or coordinator review fields'
      USING ERRCODE = '42501';
  END IF;

  -- Worker mutation scope: only own Draft or Needs Correction reports
  IF NOT caller_is_coord THEN
    IF OLD.created_by <> caller_id THEN
      RAISE EXCEPTION 'Workers may only update their own reports'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.status NOT IN ('Draft', 'Needs Correction') THEN
      RAISE EXCEPTION 'Submitted reports cannot be modified unless returned for correction'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.status NOT IN ('Draft', 'Submitted', 'Needs Correction') THEN
      RAISE EXCEPTION 'Workers may only save drafts or submit reports'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Workflow transition matrix
  IF NEW.status = OLD.status THEN
    transition_allowed := true;
  ELSE
    CASE OLD.status
      WHEN 'Draft' THEN
        transition_allowed := NEW.status IN ('Submitted');
      WHEN 'Submitted' THEN
        transition_allowed := NEW.status IN ('Assigned', 'In Progress', 'Needs Correction', 'Rejected', 'Resolved');
      WHEN 'Assigned' THEN
        transition_allowed := NEW.status IN ('In Progress', 'Needs Correction', 'Rejected', 'Resolved');
      WHEN 'In Progress' THEN
        transition_allowed := NEW.status IN ('Assigned', 'Needs Correction', 'Rejected', 'Resolved');
      WHEN 'Needs Correction' THEN
        transition_allowed := NEW.status IN ('Submitted', 'Assigned', 'Rejected');
      WHEN 'Resolved' THEN
        -- Reopen workflow (coordinator-only, enforced above)
        transition_allowed := NEW.status IN ('In Progress', 'Assigned', 'Submitted');
      WHEN 'Rejected' THEN
        transition_allowed := false; -- Terminal state
      ELSE
        transition_allowed := false;
    END CASE;
  END IF;

  IF NOT transition_allowed THEN
    RAISE EXCEPTION 'Invalid report status transition from % to %', OLD.status, NEW.status
      USING ERRCODE = '23514';
  END IF;

  -- Status-specific invariants
  IF NEW.status IN ('Assigned', 'In Progress') AND NEW.assigned_to IS NULL THEN
    RAISE EXCEPTION 'Reports with status % require an assigned worker', NEW.status
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'Rejected' AND pg_catalog.length(pg_catalog.btrim(COALESCE(NEW.rejection_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'Rejected reports require a rejection_reason'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'Needs Correction' AND pg_catalog.length(pg_catalog.btrim(COALESCE(NEW.correction_notes, ''))) = 0 THEN
    RAISE EXCEPTION 'Needs Correction reports require correction_notes'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'Submitted' AND OLD.status <> 'Submitted' THEN
    NEW.submitted_at := COALESCE(NEW.submitted_at, pg_catalog.now());
  END IF;

  IF NEW.status = 'Resolved' AND OLD.status <> 'Resolved' THEN
    NEW.resolved_at := pg_catalog.now();
  ELSIF OLD.status = 'Resolved' AND NEW.status <> 'Resolved' THEN
    NEW.resolved_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 8. Preserve assignment history whenever assigned_to is set or changed
CREATE OR REPLACE FUNCTION public.record_report_assignment_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_uuid UUID;
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (
    TG_OP = 'INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
  ) THEN
    actor_uuid := COALESCE(NEW.assigned_by, auth.uid(), NEW.created_by);

    INSERT INTO public.report_assignments (
      report_id,
      worker_id,
      assigned_by,
      assigned_at,
      notes
    )
    VALUES (
      NEW.id,
      NEW.assigned_to,
      actor_uuid,
      pg_catalog.now(),
      CASE
        WHEN TG_OP = 'INSERT' THEN 'Initial assignment'
        ELSE 'Worker assigned or reassigned'
      END
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 9. Append-only audit log writer for report lifecycle events
CREATE OR REPLACE FUNCTION public.log_report_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_uuid UUID := COALESCE(auth.uid(), NEW.assigned_by, NEW.created_by);
  event_action TEXT;
  event_description TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (
      report_id,
      actor_id,
      action,
      old_value,
      new_value,
      description
    )
    VALUES (
      NEW.id,
      actor_uuid,
      CASE WHEN NEW.status = 'Submitted' THEN 'submitted' ELSE 'created' END,
      NULL,
      pg_catalog.jsonb_build_object(
        'report_number', NEW.report_number,
        'status', NEW.status,
        'priority', NEW.priority,
        'category', NEW.category
      ),
      CASE
        WHEN NEW.status = 'Submitted' THEN 'Report created and submitted'
        ELSE 'Draft report created'
      END
    );
    RETURN NEW;
  END IF;

  -- Log assignment changes independently if assigned_to changed
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.activity_logs (
      report_id,
      actor_id,
      action,
      old_value,
      new_value,
      description
    )
    VALUES (
      NEW.id,
      actor_uuid,
      'assigned',
      pg_catalog.jsonb_build_object('assigned_to', OLD.assigned_to),
      pg_catalog.jsonb_build_object('assigned_to', NEW.assigned_to),
      'Report assigned to field worker'
    );
  END IF;

  -- Log status transitions
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'Submitted' THEN
      event_action := 'submitted';
      event_description := 'Report submitted for coordinator review';
    ELSIF NEW.status = 'Rejected' THEN
      event_action := 'rejected';
      event_description := COALESCE('Report rejected: ' || NEW.rejection_reason, 'Report rejected');
    ELSIF NEW.status = 'Needs Correction' THEN
      event_action := 'correction_requested';
      event_description := COALESCE('Returned for correction: ' || NEW.correction_notes, 'Returned for correction');
    ELSIF NEW.status = 'Resolved' THEN
      event_action := 'resolved';
      event_description := 'Report marked as Resolved';
    ELSIF OLD.status = 'Resolved' THEN
      event_action := 'reopened';
      event_description := pg_catalog.format('Resolved report reopened to %s', NEW.status);
    ELSE
      event_action := 'status_changed';
      event_description := pg_catalog.format('Status changed from %s to %s', OLD.status, NEW.status);
    END IF;

    INSERT INTO public.activity_logs (
      report_id,
      actor_id,
      action,
      old_value,
      new_value,
      description
    )
    VALUES (
      NEW.id,
      actor_uuid,
      event_action,
      pg_catalog.jsonb_build_object('status', OLD.status),
      pg_catalog.jsonb_build_object(
        'status', NEW.status,
        'rejection_reason', NEW.rejection_reason,
        'correction_notes', NEW.correction_notes
      ),
      event_description
    );
  ELSIF (
    NEW.title IS DISTINCT FROM OLD.title
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.location IS DISTINCT FROM OLD.location
    OR NEW.category IS DISTINCT FROM OLD.category
    OR NEW.priority IS DISTINCT FROM OLD.priority
  ) THEN
    INSERT INTO public.activity_logs (
      report_id,
      actor_id,
      action,
      old_value,
      new_value,
      description
    )
    VALUES (
      NEW.id,
      actor_uuid,
      'updated',
      pg_catalog.jsonb_build_object(
        'title', OLD.title,
        'category', OLD.category,
        'priority', OLD.priority,
        'location', OLD.location
      ),
      pg_catalog.jsonb_build_object(
        'title', NEW.title,
        'category', NEW.category,
        'priority', NEW.priority,
        'location', NEW.location
      ),
      'Report details updated'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 10. Hardened idempotent offline report synchronization RPC
--     Enforces caller ownership, prevents cross-user collisions, handles UUID/idempotency conflicts
--     without overwriting existing report content, and preserves client-generated UUIDs.
CREATE OR REPLACE FUNCTION public.sync_report_idempotent(
  p_id UUID,
  p_idempotency_key TEXT,
  p_title TEXT,
  p_category TEXT,
  p_description TEXT,
  p_location TEXT,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_priority TEXT DEFAULT 'medium',
  p_status TEXT DEFAULT 'Submitted',
  p_client_created_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS public.reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID := auth.uid();
  normalized_key TEXT := NULLIF(pg_catalog.btrim(COALESCE(p_idempotency_key, '')), '');
  target_id UUID := COALESCE(p_id, pg_catalog.gen_random_uuid());
  existing_by_key public.reports;
  existing_by_id public.reports;
  inserted_row public.reports;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required for report synchronization'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = caller_id
      AND p.is_active = true
  ) THEN
    RAISE EXCEPTION 'Active user profile required for report synchronization'
      USING ERRCODE = '42501';
  END IF;

  IF normalized_key IS NULL THEN
    RAISE EXCEPTION 'idempotency_key is required for offline synchronization'
      USING ERRCODE = '22023';
  END IF;

  IF p_status NOT IN ('Draft', 'Submitted') THEN
    RAISE EXCEPTION 'Offline sync may only create Draft or Submitted reports'
      USING ERRCODE = '42501';
  END IF;

  -- Check existing record by idempotency_key
  SELECT r.*
  INTO existing_by_key
  FROM public.reports AS r
  WHERE r.idempotency_key = normalized_key
  LIMIT 1;

  IF FOUND THEN
    IF existing_by_key.created_by <> caller_id THEN
      RAISE EXCEPTION 'Idempotency key conflict'
        USING ERRCODE = '23505';
    END IF;

    IF p_id IS NOT NULL AND existing_by_key.id <> p_id THEN
      RAISE EXCEPTION 'Idempotency key is already bound to a different report UUID'
        USING ERRCODE = '23505';
    END IF;

    RETURN existing_by_key;
  END IF;

  -- Check existing record by client UUID when provided
  IF p_id IS NOT NULL THEN
    SELECT r.*
    INTO existing_by_id
    FROM public.reports AS r
    WHERE r.id = p_id
    LIMIT 1;

    IF FOUND THEN
      IF existing_by_id.created_by <> caller_id THEN
        RAISE EXCEPTION 'Report UUID conflict'
          USING ERRCODE = '23505';
      END IF;

      IF existing_by_id.idempotency_key IS DISTINCT FROM normalized_key THEN
        RAISE EXCEPTION 'Report UUID already exists with a different idempotency_key'
          USING ERRCODE = '23505';
      END IF;

      RETURN existing_by_id;
    END IF;
  END IF;

  -- Attempt atomic insert without overwriting any concurrent conflicting row
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
  VALUES (
    target_id,
    p_title,
    p_category,
    p_description,
    p_location,
    p_latitude,
    p_longitude,
    COALESCE(p_priority, 'medium'),
    p_status,
    caller_id,
    p_client_created_at,
    normalized_key
  )
  ON CONFLICT DO NOTHING
  RETURNING * INTO inserted_row;

  IF FOUND THEN
    RETURN inserted_row;
  END IF;

  -- Re-check after concurrent insert conflict
  SELECT r.*
  INTO existing_by_key
  FROM public.reports AS r
  WHERE r.idempotency_key = normalized_key
    AND r.created_by = caller_id
    AND (p_id IS NULL OR r.id = p_id)
  LIMIT 1;

  IF FOUND THEN
    RETURN existing_by_key;
  END IF;

  RAISE EXCEPTION 'Report synchronization conflict on id or idempotency_key'
    USING ERRCODE = '23505';
END;
$$;

-- Register Triggers
CREATE TRIGGER trg_profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_profiles_protect_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privilege_escalation();

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER trg_reports_generate_report_number
  BEFORE INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_report_number();

CREATE TRIGGER trg_reports_enforce_workflow
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_report_workflow();

CREATE TRIGGER trg_reports_set_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_reports_record_assignment_history
  AFTER INSERT OR UPDATE OF assigned_to ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.record_report_assignment_history();

CREATE TRIGGER trg_reports_log_activity
  AFTER INSERT OR UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.log_report_activity();

-- Safe, non-destructive backfill for pre-existing auth.users missing a public.profiles row.
-- Always sets role = 'worker' and preserves all existing profile records untouched.
INSERT INTO public.profiles (id, full_name, email, phone, role, is_active)
SELECT
  u.id,
  pg_catalog.btrim(
    COALESCE(
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name',
      ''
    )
  ),
  COALESCE(u.email, ''),
  NULLIF(pg_catalog.btrim(COALESCE(u.phone, u.raw_user_meta_data ->> 'phone', '')), ''),
  'worker',
  true
FROM auth.users AS u
LEFT JOIN public.profiles AS p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Explicit function execution privilege hardening:
-- 1. Trigger functions are not directly executable by client roles.
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_report_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_report_workflow() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_report_assignment_history() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_report_activity() FROM PUBLIC, anon, authenticated;

-- 2. RLS and Storage helpers are restricted to authenticated and service_role only.
REVOKE ALL ON FUNCTION public.try_parse_uuid(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.try_parse_uuid(TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_active_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_coordinator(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_coordinator(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.can_access_report(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_report(UUID, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.can_edit_report_evidence(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_report_evidence(UUID, UUID) TO authenticated, service_role;

-- 3. Offline sync RPC requires auth.uid() and an active profile, so grant EXECUTE to authenticated only.
REVOKE ALL ON FUNCTION public.sync_report_idempotent(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  TEXT,
  TEXT,
  TIMESTAMPTZ
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.sync_report_idempotent(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  TEXT,
  TEXT,
  TIMESTAMPTZ
) TO authenticated;

COMMIT;
