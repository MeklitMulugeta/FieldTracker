# FieldTrack Database Setup & Migration Review Guide

This guide explains how to review, verify, and apply the FieldTrack SQL migrations in `supabase/migrations/` when you are ready to provision the database schema in your Supabase project.

## 1. Migration Order

Migrations must be applied in strict numerical order:

1. `supabase/migrations/0001_extensions_and_types.sql` — Enables `pgcrypto` and creates `public.report_number_seq`.
2. `supabase/migrations/0002_create_core_tables.sql` — Creates `profiles`, `reports`, `report_attachments`, `report_assignments`, and `activity_logs` with constraints.
3. `supabase/migrations/0003_indexes.sql` — Creates lookup, performance, and idempotency indexes.
4. `supabase/migrations/0004_functions_and_triggers.sql` — Creates `SECURITY DEFINER` helpers, privilege guards, report numbering, workflow enforcement, assignment history, activity logging triggers, and `sync_report_idempotent()`.
5. `supabase/migrations/0005_rls_policies.sql` — Enables RLS on all 5 tables, sets worker/coordinator policies, and revokes direct writes to `activity_logs`.
6. `supabase/migrations/0006_storage_bucket_and_policies.sql` — Creates the private `fieldtrack-evidence` bucket and `storage.objects` authorization policies.

## 2. Pre-Application Review Checklist

Before applying migrations to a remote Supabase project:

1. **Inspect each SQL file** in `supabase/migrations/` sequentially (`0001` through `0006`).
2. **Verify no conflicting tables exist** in the target `public` schema (`profiles`, `reports`, `report_attachments`, `report_assignments`, `activity_logs`).
3. **Confirm bucket ID**: Ensure `fieldtrack-evidence` does not conflict with an existing public bucket in Supabase Storage.
4. **Confirm transaction safety**: Every migration is wrapped in `BEGIN; ... COMMIT;` so partial failures roll back cleanly.

## 3. Applying Migrations via Supabase CLI (Recommended)

Ensure the [Supabase CLI](https://supabase.com/docs/guides/cli) is installed and linked to your project:

```bash
# 1. Authenticate and link to your existing Supabase project
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>

# 2. Preview pending migration status
supabase migration list

# 3. Apply migrations cleanly
supabase db push
```

## 4. Applying Migrations via Supabase Dashboard SQL Editor

If applying manually through the Supabase Dashboard:

1. Open **SQL Editor** in your Supabase project.
2. Copy and execute each migration file **one by one in order** (`0001` -> `0006`).
3. Do not run `supabase/seed.sql` in production; only run it in local or staging environments after test accounts exist.

## 5. Granting Coordinator Privileges Safely

Every newly registered user receives `role = 'worker'` automatically. To promote a trusted user to `coordinator`, run the following from a privileged administrative SQL session (never from client code):

```sql
UPDATE public.profiles
SET role = 'coordinator'
WHERE email = 'coordinator@example.com';
```

## 6. Post-Migration Verification Queries

After applying migrations, verify in the SQL Editor:

```sql
-- Confirm RLS is enabled on all 5 tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'reports', 'report_attachments', 'report_assignments', 'activity_logs');

-- Confirm private evidence bucket
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'fieldtrack-evidence';

-- Confirm storage.objects ownership column(s) matched by delete policy
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'storage'
  AND table_name = 'objects'
  AND column_name IN ('owner', 'owner_id');
```

## 7. Isolated Pre-Deployment Testing (Recommended Before `db push`)

Never test unverified migrations against a hosted Supabase project. FieldTrack provides two isolated local verification paths:

### A. Full Local Supabase + Docker Verification (High Fidelity)

Requires Docker and the Supabase CLI installed on your machine. Keep the repository **unlinked** (do not run `supabase link` prior to local testing):

```bash
# 1. Start the isolated local Supabase stack (PostgreSQL, GoTrue, Storage)
supabase start

# 2. Apply migrations 0001-0006 + seed.sql to the local database only
supabase db reset --local

# 3. Run the safe isolated verification runner (refuses remote DB URLs or linked projects)
./scripts/test-migrations-local.sh
```

When finished inspecting locally:

```bash
supabase stop
```

### B. In-Memory PGlite Verification (Simulated Workspace Smoke Tests)

For fast feedback without Docker, Vitest runs `server/tests/migrations-pglite.test.ts` using `@electric-sql/pglite` (in-memory WASM PostgreSQL) with test-only fixtures for Supabase `auth`, `storage`, and roles (`anon`, `authenticated`, `service_role`).

```bash
npm run test
```

> **Important:** PGlite runs in-memory PostgreSQL with simulated `auth`/`storage` schemas and does not replace running `./scripts/test-migrations-local.sh` against real Supabase containers (`supabase start` / `supabase db reset --local`) before promoting changes to a hosted project.

