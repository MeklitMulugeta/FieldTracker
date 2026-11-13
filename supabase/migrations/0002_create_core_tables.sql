-- 0002_create_core_tables.sql
-- FieldTrack core domain tables, foreign keys, integrity checks, and offline sync constraints.

BEGIN;

-- A. User profiles (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'worker',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_role_check CHECK (role IN ('worker', 'coordinator'))
);

-- B. Field issue reports (supports offline UUIDs, idempotency keys, and workflow state)
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'Draft',
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  correction_notes TEXT,
  client_created_at TIMESTAMPTZ,
  idempotency_key TEXT,
  CONSTRAINT reports_report_number_unique UNIQUE (report_number),
  CONSTRAINT reports_idempotency_key_unique UNIQUE (idempotency_key),
  CONSTRAINT reports_category_check CHECK (
    category IN (
      'Water Supply',
      'Equipment Damage',
      'Infrastructure Damage',
      'Service Interruption',
      'Safety Concern',
      'Maintenance',
      'Other'
    )
  ),
  CONSTRAINT reports_priority_check CHECK (
    priority IN ('low', 'medium', 'high', 'critical')
  ),
  CONSTRAINT reports_status_check CHECK (
    status IN (
      'Draft',
      'Submitted',
      'Assigned',
      'In Progress',
      'Resolved',
      'Needs Correction',
      'Rejected'
    )
  ),
  CONSTRAINT reports_latitude_check CHECK (
    latitude IS NULL OR (latitude >= -90 AND latitude <= 90)
  ),
  CONSTRAINT reports_longitude_check CHECK (
    longitude IS NULL OR (longitude >= -180 AND longitude <= 180)
  ),
  CONSTRAINT reports_rejection_reason_required_check CHECK (
    status <> 'Rejected' OR length(btrim(COALESCE(rejection_reason, ''))) > 0
  ),
  CONSTRAINT reports_correction_notes_required_check CHECK (
    status <> 'Needs Correction' OR length(btrim(COALESCE(correction_notes, ''))) > 0
  ),
  CONSTRAINT reports_assigned_worker_required_check CHECK (
    status NOT IN ('Assigned', 'In Progress') OR assigned_to IS NOT NULL
  )
);

-- C. Report evidence attachments stored in private bucket 'fieldtrack-evidence'
CREATE TABLE public.report_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT report_attachments_storage_path_unique UNIQUE (storage_path),
  CONSTRAINT report_attachments_file_size_check CHECK (file_size > 0)
);

-- D. Immutable assignment history for field reports
CREATE TABLE public.report_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assigned_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

-- E. Append-only audit log for report lifecycle events
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
