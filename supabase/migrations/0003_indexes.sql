-- 0003_indexes.sql
-- Performance and lookup indexes for FieldTrack tables.

BEGIN;

-- Reports query indexes
CREATE INDEX idx_reports_status ON public.reports (status);
CREATE INDEX idx_reports_created_by ON public.reports (created_by);
CREATE INDEX idx_reports_assigned_to ON public.reports (assigned_to);
CREATE INDEX idx_reports_created_at ON public.reports (created_at DESC);
CREATE INDEX idx_reports_category ON public.reports (category);
CREATE INDEX idx_reports_priority ON public.reports (priority);
CREATE INDEX idx_reports_report_number ON public.reports (report_number);
CREATE INDEX idx_reports_idempotency_key ON public.reports (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_reports_status_priority_created_at
  ON public.reports (status, priority, created_at DESC);

-- Report attachments indexes
CREATE INDEX idx_report_attachments_report_id ON public.report_attachments (report_id);
CREATE INDEX idx_report_attachments_uploaded_by ON public.report_attachments (uploaded_by);

-- Report assignments indexes
CREATE INDEX idx_report_assignments_report_id_assigned_at
  ON public.report_assignments (report_id, assigned_at DESC);
CREATE INDEX idx_report_assignments_worker_id ON public.report_assignments (worker_id);

-- Activity logs indexes
CREATE INDEX idx_activity_logs_report_id_created_at
  ON public.activity_logs (report_id, created_at DESC);
CREATE INDEX idx_activity_logs_actor_id ON public.activity_logs (actor_id);

COMMIT;
