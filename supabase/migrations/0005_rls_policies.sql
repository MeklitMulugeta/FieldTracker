-- 0005_rls_policies.sql
-- Explicit least-privilege database grants and Row Level Security policies across all FieldTrack tables.

BEGIN;

-- =============================================================================
-- Least-privilege table & sequence grants
-- =============================================================================
REVOKE ALL ON TABLE
  public.profiles,
  public.reports,
  public.report_attachments,
  public.report_assignments,
  public.activity_logs
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON SEQUENCE public.report_number_seq FROM PUBLIC, anon, authenticated;

GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, UPDATE, DELETE ON TABLE public.reports TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.report_attachments TO authenticated;
GRANT SELECT ON TABLE public.report_assignments TO authenticated;
GRANT SELECT ON TABLE public.activity_logs TO authenticated;

GRANT ALL ON TABLE
  public.profiles,
  public.reports,
  public.report_attachments,
  public.report_assignments,
  public.activity_logs
TO service_role;

GRANT ALL ON SEQUENCE public.report_number_seq TO service_role;

-- Enable RLS on all application tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- A. profiles policies
-- =============================================================================
CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_select_coordinator
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_coordinator(auth.uid()));

-- Active workers and coordinators may update their own contact details,
-- but role and activation state cannot be changed (enforced by WITH CHECK + trigger).
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    AND public.is_active_user()
  )
  WITH CHECK (
    id = auth.uid()
    AND public.is_active_user()
    AND role = public.current_user_role()
  );

-- =============================================================================
-- B. reports policies
-- =============================================================================
CREATE POLICY reports_select_own_or_assigned
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_user()
    AND (
      created_by = auth.uid()
      OR assigned_to = auth.uid()
    )
  );

CREATE POLICY reports_select_coordinator
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (public.is_coordinator(auth.uid()));

-- Report creation for authenticated clients goes exclusively through public.sync_report_idempotent()
CREATE POLICY reports_update_worker_editable
  ON public.reports
  FOR UPDATE
  TO authenticated
  USING (
    public.is_active_user()
    AND created_by = auth.uid()
    AND status IN ('Draft', 'Needs Correction')
  )
  WITH CHECK (
    public.is_active_user()
    AND created_by = auth.uid()
    AND status IN ('Draft', 'Submitted', 'Needs Correction')
  );

CREATE POLICY reports_update_coordinator
  ON public.reports
  FOR UPDATE
  TO authenticated
  USING (public.is_coordinator(auth.uid()))
  WITH CHECK (public.is_coordinator(auth.uid()));

CREATE POLICY reports_delete_own_draft
  ON public.reports
  FOR DELETE
  TO authenticated
  USING (
    public.is_active_user()
    AND created_by = auth.uid()
    AND status = 'Draft'
  );

-- =============================================================================
-- C. report_attachments policies
-- =============================================================================
CREATE POLICY report_attachments_select_authorized
  ON public.report_attachments
  FOR SELECT
  TO authenticated
  USING (public.can_access_report(report_id, auth.uid()));

CREATE POLICY report_attachments_insert_authorized
  ON public.report_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND public.can_edit_report_evidence(report_id, auth.uid())
  );

CREATE POLICY report_attachments_delete_authorized
  ON public.report_attachments
  FOR DELETE
  TO authenticated
  USING (
    public.is_coordinator(auth.uid())
    OR (
      uploaded_by = auth.uid()
      AND public.can_edit_report_evidence(report_id, auth.uid())
    )
  );

-- =============================================================================
-- D. report_assignments policies (trigger-populated audit trail; read-only for clients)
-- =============================================================================
CREATE POLICY report_assignments_select_authorized
  ON public.report_assignments
  FOR SELECT
  TO authenticated
  USING (public.can_access_report(report_id, auth.uid()));

-- =============================================================================
-- E. activity_logs policies (read-only for authorized users, immutable history)
-- =============================================================================
CREATE POLICY activity_logs_select_authorized
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (public.can_access_report(report_id, auth.uid()));

COMMIT;
