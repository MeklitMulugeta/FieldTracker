# FieldTrack Database Schema Documentation

## 1. Overview

The FieldTrack PostgreSQL schema is defined as sequential, transaction-wrapped SQL migrations under `supabase/migrations/`. It provides role-aware field issue tracking, immutable audit and assignment histories, private evidence storage, and idempotent offline synchronization.

## 2. Tables & Relationships

### `public.profiles`
Extends `auth.users` with FieldTrack operational metadata.
- **Primary Key**: `id` (`UUID`, references `auth.users(id) ON DELETE CASCADE`)
- **Columns**: `full_name`, `email`, `phone`, `role` (`'worker'` | `'coordinator'`, default `'worker'`), `is_active` (`BOOLEAN`, default `true`), `created_at`, `updated_at`
- **Registration & Backfill**:
  - `handle_new_user()` (`AFTER INSERT ON auth.users`) always inserts `role = 'worker'`, ignoring untrusted signup metadata.
  - Migration `0004` safely backfills any pre-existing `auth.users` missing a `public.profiles` row with `role = 'worker'` and `ON CONFLICT (id) DO NOTHING`, preserving existing profiles.
- **Role Protection**:
  - `protect_profile_privilege_escalation()` (`BEFORE UPDATE`) blocks non-administrative changes to `role`, `is_active`, or `id`. Coordinator promotion requires a trusted administrative session (`service_role` or privileged SQL session).

### `public.reports`
Core field issue report record supporting offline-first client creation.
- **Primary Key**: `id` (`UUID`, defaults to `gen_random_uuid()`, accepts client-generated UUIDv4)
- **Foreign Keys**:
  - `created_by` -> `public.profiles(id) ON DELETE RESTRICT`
  - `assigned_to` -> `public.profiles(id) ON DELETE SET NULL`
  - `assigned_by` -> `public.profiles(id) ON DELETE SET NULL`
- **Unique Constraints**:
  - `report_number` (`TEXT NOT NULL UNIQUE`, auto-generated via `report_number_seq` in `FT-YYYY-NNNNNN` format, e.g., `FT-2026-000001`)
  - `idempotency_key` (`TEXT UNIQUE`, nullable for online inserts, enforces duplicate prevention during offline sync retries)
- **Categories**: `'Water Supply'`, `'Equipment Damage'`, `'Infrastructure Damage'`, `'Service Interruption'`, `'Safety Concern'`, `'Maintenance'`, `'Other'`
- **Priorities**: `'low'`, `'medium'`, `'high'`, `'critical'`
- **Statuses**: `'Draft'`, `'Submitted'`, `'Assigned'`, `'In Progress'`, `'Resolved'`, `'Needs Correction'`, `'Rejected'`
- **Integrity Checks**:
  - `latitude` in `[-90, 90]`, `longitude` in `[-180, 180]`
  - `rejection_reason` required when `status = 'Rejected'`
  - `correction_notes` required when `status = 'Needs Correction'`
  - `assigned_to` required when `status IN ('Assigned', 'In Progress')`

### `public.report_attachments`
Metadata linking evidence files in private Storage to reports.
- **Primary Key**: `id` (`UUID`)
- **Foreign Keys**: `report_id` -> `public.reports(id) ON DELETE CASCADE`, `uploaded_by` -> `public.profiles(id) ON DELETE RESTRICT`
- **Constraints**: `storage_path` is `UNIQUE`, `file_size > 0`

### `public.report_assignments`
Append-only assignment audit trail preserving every assignment/reassignment event.
- **Primary Key**: `id` (`UUID`)
- **Foreign Keys**: `report_id` -> `public.reports(id) ON DELETE CASCADE`, `worker_id` -> `public.profiles(id) ON DELETE RESTRICT`, `assigned_by` -> `public.profiles(id) ON DELETE RESTRICT`
- **Trigger**: `record_report_assignment_history()` automatically appends a row whenever `reports.assigned_to` is set or changed.

### `public.activity_logs`
Immutable JSONB lifecycle audit log.
- **Primary Key**: `id` (`UUID`)
- **Foreign Keys**: `report_id` -> `public.reports(id) ON DELETE CASCADE`, `actor_id` -> `public.profiles(id) ON DELETE SET NULL`
- **Columns**: `action`, `old_value` (`JSONB`), `new_value` (`JSONB`), `description`, `created_at`
- **Immutability**: Direct `INSERT`, `UPDATE`, and `DELETE` are revoked from `PUBLIC`, `anon`, and `authenticated`; records are written solely by `log_report_activity()` (`SECURITY DEFINER`).

## 3. Report Workflow & State Transitions

Enforced by `enforce_report_workflow()` (`BEFORE UPDATE ON public.reports`):

- `Draft` -> `Submitted` (Worker creator or Coordinator)
- `Submitted` -> `Assigned`, `In Progress`, `Needs Correction`, `Rejected`, `Resolved` (Coordinator)
- `Assigned` -> `In Progress`, `Needs Correction`, `Rejected`, `Resolved` (Coordinator)
- `In Progress` -> `Assigned`, `Needs Correction`, `Rejected`, `Resolved` (Coordinator)
- `Needs Correction` -> `Submitted` (Worker creator resubmits), `Assigned`, `Rejected` (Coordinator)
- `Resolved` -> `In Progress`, `Assigned`, `Submitted` (Coordinator reopen; clears `resolved_at`)
- `Rejected` -> Terminal (no transitions out)

Automatically assigns `Submitted -> Assigned` when a coordinator populates `assigned_to`. Both `Assigned` and `In Progress` require `assigned_to` to be populated.

## 4. Row Level Security (RLS), Privileges & Helper Functions

All `SECURITY DEFINER` helpers use `SET search_path = ''`, verify `is_active = true`, and prevent ordinary `authenticated` callers from passing another user's UUID (`p_user_id = auth.uid()`, while `service_role` or SQL admin sessions may inspect any user):
- `public.is_active_user()`
- `public.current_user_role()`
- `public.is_coordinator(p_user_id)`
- `public.can_access_report(p_report_id, p_user_id)`
- `public.can_edit_report_evidence(p_report_id, p_user_id)`

**Execution & Table Privileges**:
- Trigger functions have `EXECUTE` revoked from `PUBLIC`, `anon`, and `authenticated`.
- Helper functions grant `EXECUTE` only to `authenticated` and `service_role` (revoked from `PUBLIC` and `anon`).
- `sync_report_idempotent()` (`SECURITY DEFINER`) grants `EXECUTE` strictly to `authenticated` (requiring `auth.uid()` and an active profile) and serves as the sole client report-creation mechanism.
- All table and sequence privileges are revoked from `PUBLIC` and `anon`, with least-privilege `GRANT` statements for `authenticated` (direct `INSERT` on `public.reports` is revoked from `authenticated`).

| Table | Worker Access | Coordinator Access |
| :--- | :--- | :--- |
| `profiles` | Read own; update own contact fields if active (role locked) | Read all profiles; update own contact fields if active (role locked) |
| `reports` | Active users only: read own/assigned; create Draft/Submitted via `sync_report_idempotent()`; edit own `Draft`/`Needs Correction`; delete own `Draft` | Active coordinators only: read all; create via `sync_report_idempotent()`; update workflow statuses, assignments, reasons, resolution, reopen |
| `report_attachments` | Read for accessible reports; upload/delete on own editable or active assigned reports | Read all; upload/delete evidence |
| `report_assignments` | Read for accessible reports (`SELECT` only; populated by trigger) | Read all (`SELECT` only; populated by trigger) |
| `activity_logs` | Read for accessible reports (`SELECT` only) | Read all (`SELECT` only) |

## 5. Private Storage (`fieldtrack-evidence`)

- Bucket `fieldtrack-evidence` is created with `public = false`, 10 MB file size limit, and allowed image/PDF MIME types. Existing buckets are never silently overwritten; incompatible existing configurations raise an explicit migration error for manual review.
- Object path convention: `<report_uuid>/<filename>`.
- `storage.objects` policies use `try_parse_uuid((storage.foldername(name))[1])`:
  - `SELECT`: Permitted when `can_access_report(report_id, auth.uid())` is true.
  - `INSERT`: Permitted when `can_edit_report_evidence(report_id, auth.uid())` is true.
  - `UPDATE`: Denied (no policy) so uploaded evidence objects cannot be silently overwritten.
  - `DELETE`: Permitted for coordinators or the uploader (`owner` / `owner_id` verified against `information_schema.columns` at migration time) while the report remains editable.

## 6. Offline Synchronization Support

- **Stable Client UUIDs**: `reports.id` accepts client-generated UUIDv4 values.
- **Idempotency**: `reports.idempotency_key` carries a `UNIQUE` constraint and partial index.
- **Timestamps**: `client_created_at` preserves offline capture time separately from server `created_at`.
- **Exclusive Creation & Safe Retry RPC**: Direct table `INSERT` on `public.reports` is revoked from `authenticated`. All client report creation must go through `public.sync_report_idempotent(...)` (`SECURITY DEFINER`), which requires an active profile (`is_active = true`), binds `created_by = auth.uid()`, restricts initial statuses to `Draft`/`Submitted`, rejects cross-user collisions and UUID/idempotency-key mismatches with explicit `23505` errors, never overwrites existing records, and returns the original synced row on exact retries.
