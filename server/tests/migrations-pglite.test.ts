import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migrationsDir = path.resolve(process.cwd(), '../supabase/migrations');
const seedSqlPath = path.resolve(process.cwd(), '../supabase/seed.sql');

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(migrationsDir, filename), 'utf8');
}

const WORKER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const WORKER_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const COORD_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const INACTIVE_ID = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
const PREEXISTING_ID = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';

async function asAuthenticated<T>(
  db: PGlite,
  userId: string,
  fn: () => Promise<T>,
): Promise<T> {
  await db.exec('BEGIN;');
  try {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);
    await db.exec('SET LOCAL ROLE authenticated;');
    const result = await fn();
    await db.exec('COMMIT;');
    return result;
  } catch (err) {
    await db.exec('ROLLBACK;');
    throw err;
  }
}

async function asAnon<T>(db: PGlite, fn: () => Promise<T>): Promise<T> {
  await db.exec('BEGIN;');
  try {
    await db.query(`SELECT set_config('request.jwt.claim.sub', '', true)`);
    await db.query(`SELECT set_config('request.jwt.claim.role', 'anon', true)`);
    await db.exec('SET LOCAL ROLE anon;');
    const result = await fn();
    await db.exec('COMMIT;');
    return result;
  } catch (err) {
    await db.exec('ROLLBACK;');
    throw err;
  }
}

describe('isolated in-memory PGlite SQL migration verification (simulated Supabase harness)', () => {
  let db: PGlite;
  let pgcryptoSupportedInPglite = false;

  beforeAll(async () => {
    // Completely isolated in-memory PostgreSQL instance (no network or hosted Supabase access)
    db = new PGlite();

    // Test-only Supabase fixture: roles, auth schema, storage schema
    await db.exec(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN NOINHERIT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN NOINHERIT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
        END IF;
      END $$;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE SCHEMA IF NOT EXISTS storage;

      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
      GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
      GRANT USAGE ON SCHEMA storage TO authenticated, service_role;

      CREATE TABLE auth.users (
        id UUID PRIMARY KEY,
        email TEXT,
        phone TEXT,
        raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID
      LANGUAGE sql
      STABLE
      AS $$
        SELECT NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::UUID;
      $$;

      CREATE OR REPLACE FUNCTION auth.role()
      RETURNS TEXT
      LANGUAGE sql
      STABLE
      AS $$
        SELECT NULLIF(pg_catalog.current_setting('request.jwt.claim.role', true), '');
      $$;

      GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;

      CREATE TABLE storage.buckets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        public BOOLEAN NOT NULL DEFAULT false,
        file_size_limit BIGINT,
        allowed_mime_types TEXT[]
      );

      CREATE TABLE storage.objects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bucket_id TEXT NOT NULL REFERENCES storage.buckets(id),
        name TEXT NOT NULL,
        owner UUID,
        owner_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

      CREATE OR REPLACE FUNCTION storage.foldername(name TEXT)
      RETURNS TEXT[]
      LANGUAGE sql
      IMMUTABLE
      AS $$
        SELECT pg_catalog.string_to_array(
          pg_catalog.regexp_replace(COALESCE(name, ''), '^/+', ''),
          '/'
        );
      $$;

      GRANT SELECT ON TABLE storage.buckets TO authenticated, service_role;
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE storage.objects TO authenticated, service_role;
      GRANT EXECUTE ON FUNCTION storage.foldername(TEXT) TO authenticated, service_role;

      -- Seed one pre-existing auth.users row before 0004 runs to exercise non-destructive backfill
      INSERT INTO auth.users (id, email, raw_user_meta_data)
      VALUES ('${PREEXISTING_ID}', 'preexisting@fieldtrack.local', '{"full_name":"Preexisting Worker"}'::jsonb);
    `);

    // 0001_extensions_and_types.sql: test pgcrypto support in PGlite without altering the SQL file
    const migration0001 = readMigration('0001_extensions_and_types.sql');
    try {
      await db.exec(migration0001);
      pgcryptoSupportedInPglite = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // 0001 wraps statements in BEGIN; ... COMMIT;, so roll back the aborted transaction first
      await db.exec('ROLLBACK;').catch(() => {});
      if (/pgcrypto/i.test(message)) {
        pgcryptoSupportedInPglite = false;
        // Run 0001 excluding only the unsupported CREATE EXTENSION statement in PGlite
        const withoutExtension = migration0001.replace(/CREATE\s+EXTENSION[^;]+;/i, '');
        await db.exec(withoutExtension);
      } else {
        throw err;
      }
    }

    // Execute 0002 through 0006 verbatim
    await db.exec(readMigration('0002_create_core_tables.sql'));
    await db.exec(readMigration('0003_indexes.sql'));
    await db.exec(readMigration('0004_functions_and_triggers.sql'));
    await db.exec(readMigration('0005_rls_policies.sql'));
    await db.exec(readMigration('0006_storage_bucket_and_policies.sql'));
  });

  afterAll(async () => {
    await db?.close();
  });

  it('documents PGlite pgcrypto availability and verifies all 5 tables, RLS flags, and bucket setup', async () => {
    // Explicitly record whether PGlite bundled pgcrypto (built-in gen_random_uuid() is used regardless)
    expect(typeof pgcryptoSupportedInPglite).toBe('boolean');

    const tablesRes = await db.query<{ relname: string; relrowsecurity: boolean }>(`
      SELECT c.relname, c.relrowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('profiles', 'reports', 'report_attachments', 'report_assignments', 'activity_logs')
      ORDER BY c.relname;
    `);

    expect(tablesRes.rows).toHaveLength(5);
    for (const row of tablesRes.rows) {
      expect(row.relrowsecurity).toBe(true);
    }

    const bucketRes = await db.query<{ id: string; public: boolean; file_size_limit: string }>(`
      SELECT id, public, file_size_limit::text
      FROM storage.buckets
      WHERE id = 'fieldtrack-evidence';
    `);
    expect(bucketRes.rows).toEqual([
      { id: 'fieldtrack-evidence', public: false, file_size_limit: '10485760' },
    ]);
  });

  it('backfills pre-existing auth.users safely and enforces default worker role on signup', async () => {
    // Verify pre-existing user inserted before 0004 was backfilled as worker
    const preexistingProfile = await db.query<{ role: string; is_active: boolean; full_name: string }>(
      `SELECT role, is_active, full_name FROM public.profiles WHERE id = $1`,
      [PREEXISTING_ID],
    );
    expect(preexistingProfile.rows[0]).toEqual({
      role: 'worker',
      is_active: true,
      full_name: 'Preexisting Worker',
    });

    // Insert users after triggers exist; untrusted role metadata must be ignored
    await db.exec(`
      INSERT INTO auth.users (id, email, raw_user_meta_data)
      VALUES
        ('${WORKER_A}', 'workera@fieldtrack.local', '{"full_name":"Worker Alpha","role":"coordinator"}'::jsonb),
        ('${WORKER_B}', 'workerb@fieldtrack.local', '{"full_name":"Worker Beta"}'::jsonb),
        ('${COORD_ID}', 'coord@fieldtrack.local', '{"full_name":"Coordinator Prime"}'::jsonb),
        ('${INACTIVE_ID}', 'inactive@fieldtrack.local', '{"full_name":"Inactive User"}'::jsonb);
    `);

    const workerARole = await db.query<{ role: string }>(
      `SELECT role FROM public.profiles WHERE id = $1`,
      [WORKER_A],
    );
    expect(workerARole.rows[0]?.role).toBe('worker');

    // Trusted SQL admin context promotes coordinator and deactivates inactive user
    await db.query(`UPDATE public.profiles SET role = 'coordinator' WHERE id = $1`, [COORD_ID]);
    await db.query(`UPDATE public.profiles SET is_active = false WHERE id = $1`, [INACTIVE_ID]);
  });

  it('blocks profile privilege escalation, inactive profile updates, and cross-user probing', async () => {
    // Worker cannot probe coordinator status of another user
    const probeRes = await asAuthenticated(db, WORKER_A, async () =>
      db.query<{ res: boolean }>(`SELECT public.is_coordinator($1) AS res`, [COORD_ID]),
    );
    expect(probeRes.rows[0]?.res).toBe(false);

    // Worker cannot self-promote to coordinator
    await expect(
      asAuthenticated(db, WORKER_A, async () =>
        db.query(`UPDATE public.profiles SET role = 'coordinator' WHERE id = $1`, [WORKER_A]),
      ),
    ).rejects.toThrow();

    // Active worker can update own contact info
    await asAuthenticated(db, WORKER_A, async () =>
      db.query(`UPDATE public.profiles SET phone = '+15550199' WHERE id = $1`, [WORKER_A]),
    );
    const updatedPhone = await db.query<{ phone: string }>(
      `SELECT phone FROM public.profiles WHERE id = $1`,
      [WORKER_A],
    );
    expect(updatedPhone.rows[0]?.phone).toBe('+15550199');

    // Inactive user cannot update own profile via authenticated RLS
    await asAuthenticated(db, INACTIVE_ID, async () =>
      db.query(`UPDATE public.profiles SET full_name = 'Tampered' WHERE id = $1`, [INACTIVE_ID]),
    );
    const inactiveCheck = await db.query<{ full_name: string }>(
      `SELECT full_name FROM public.profiles WHERE id = $1`,
      [INACTIVE_ID],
    );
    expect(inactiveCheck.rows[0]?.full_name).toBe('Inactive User');
  });

  it('blocks direct INSERT on public.reports and public.report_assignments for authenticated callers', async () => {
    await expect(
      asAuthenticated(db, WORKER_A, async () =>
        db.query(
          `INSERT INTO public.reports (title, category, description, location, status, created_by)
           VALUES ('Direct Insert', 'Other', 'Should fail', 'Gate 1', 'Draft', $1)`,
          [WORKER_A],
        ),
      ),
    ).rejects.toThrow(/permission denied/i);

    await expect(
      asAuthenticated(db, COORD_ID, async () =>
        db.query(
          `INSERT INTO public.report_assignments (report_id, worker_id, assigned_by, notes)
           VALUES ('11111111-1111-4111-8111-111111111999', $1, $2, 'Forged')`,
          [WORKER_B, COORD_ID],
        ),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('creates reports via sync_report_idempotent(), enforces idempotency/conflicts, and blocks anon/inactive callers', async () => {
    const reportId1 = '11111111-1111-4111-8111-111111111301';
    const reportId2 = '11111111-1111-4111-8111-111111111302';

    // Anon denied
    await expect(
      asAnon(db, async () =>
        db.query(
          `SELECT * FROM public.sync_report_idempotent($1, 'anon-key', 'Title', 'Other', 'Desc', 'Loc')`,
          [reportId2],
        ),
      ),
    ).rejects.toThrow(/permission denied/i);

    // Inactive authenticated user denied
    await expect(
      asAuthenticated(db, INACTIVE_ID, async () =>
        db.query(
          `SELECT * FROM public.sync_report_idempotent($1, 'inactive-key', 'Title', 'Other', 'Desc', 'Loc')`,
          [reportId2],
        ),
      ),
    ).rejects.toThrow(/Active user profile required/i);

    // Active worker creates Draft report
    const created = await asAuthenticated(db, WORKER_A, async () =>
      db.query<{ id: string; report_number: string; created_by: string; status: string }>(
        `SELECT id, report_number, created_by, status
         FROM public.sync_report_idempotent($1, 'idem-key-1', 'Broken Valve', 'Water Supply', 'Leak at bay 2', 'North Plant', 37.77, -122.41, 'high', 'Draft', now())`,
        [reportId1],
      ),
    );
    expect(created.rows[0]?.id).toBe(reportId1);
    expect(created.rows[0]?.created_by).toBe(WORKER_A);
    expect(created.rows[0]?.report_number).toMatch(/^FT-\d{4}-\d{6}$/);

    // Exact retry returns original row without overwriting
    const retried = await asAuthenticated(db, WORKER_A, async () =>
      db.query<{ id: string; title: string; status: string }>(
        `SELECT id, title, status
         FROM public.sync_report_idempotent($1, 'idem-key-1', 'Attempted Overwrite', 'Other', 'Changed', 'Elsewhere', NULL, NULL, 'low', 'Submitted', now())`,
        [reportId1],
      ),
    );
    expect(retried.rows[0]).toEqual({
      id: reportId1,
      title: 'Broken Valve',
      status: 'Draft',
    });

    // Different UUID with same idempotency key fails
    await expect(
      asAuthenticated(db, WORKER_A, async () =>
        db.query(
          `SELECT * FROM public.sync_report_idempotent($1, 'idem-key-1', 'Collision', 'Other', 'Desc', 'Loc')`,
          [reportId2],
        ),
      ),
    ).rejects.toThrow(/already bound to a different report UUID/i);

    // Cross-user idempotency key collision fails
    await expect(
      asAuthenticated(db, WORKER_B, async () =>
        db.query(
          `SELECT * FROM public.sync_report_idempotent($1, 'idem-key-1', 'Cross User', 'Other', 'Desc', 'Loc')`,
          [reportId2],
        ),
      ),
    ).rejects.toThrow(/Idempotency key conflict/i);
  });

  it('enforces worker/coordinator workflow transitions, assignment triggers, storage policies, and seed.sql execution', async () => {
    const reportId1 = '11111111-1111-4111-8111-111111111301';

    // Worker A uploads evidence to simulated storage.objects for own Draft report
    await asAuthenticated(db, WORKER_A, async () =>
      db.query(
        `INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('fieldtrack-evidence', $1, $2)`,
        [`${reportId1}/photo.jpg`, WORKER_A],
      ),
    );

    // Worker B cannot read Worker A's Draft report or storage object
    const workerBReports = await asAuthenticated(db, WORKER_B, async () =>
      db.query(`SELECT id FROM public.reports WHERE id = $1`, [reportId1]),
    );
    expect(workerBReports.rows).toHaveLength(0);

    const workerBObjects = await asAuthenticated(db, WORKER_B, async () =>
      db.query(`SELECT id FROM storage.objects WHERE bucket_id = 'fieldtrack-evidence'`),
    );
    expect(workerBObjects.rows).toHaveLength(0);

    // Worker A submits Draft -> Submitted
    await asAuthenticated(db, WORKER_A, async () =>
      db.query(`UPDATE public.reports SET status = 'Submitted' WHERE id = $1`, [reportId1]),
    );

    // Coordinator assigns Worker B -> auto-transitions to Assigned and writes assignment history
    await asAuthenticated(db, COORD_ID, async () =>
      db.query(`UPDATE public.reports SET assigned_to = $1 WHERE id = $2`, [WORKER_B, reportId1]),
    );

    const assignedReport = await db.query<{ status: string; assigned_to: string }>(
      `SELECT status, assigned_to FROM public.reports WHERE id = $1`,
      [reportId1],
    );
    expect(assignedReport.rows[0]).toEqual({ status: 'Assigned', assigned_to: WORKER_B });

    const assignmentHistory = await db.query<{ worker_id: string }>(
      `SELECT worker_id FROM public.report_assignments WHERE report_id = $1`,
      [reportId1],
    );
    expect(assignmentHistory.rows).toHaveLength(1);
    expect(assignmentHistory.rows[0]?.worker_id).toBe(WORKER_B);

    // Assigned Worker B can now read the report and its storage evidence
    const workerBAssignedRead = await asAuthenticated(db, WORKER_B, async () =>
      db.query(`SELECT id FROM public.reports WHERE id = $1`, [reportId1]),
    );
    expect(workerBAssignedRead.rows).toHaveLength(1);

    // Needs Correction without notes must fail
    await expect(
      asAuthenticated(db, COORD_ID, async () =>
        db.query(
          `UPDATE public.reports SET status = 'Needs Correction', correction_notes = '  ' WHERE id = $1`,
          [reportId1],
        ),
      ),
    ).rejects.toThrow();

    // Reject requires reason and is terminal
    await asAuthenticated(db, COORD_ID, async () =>
      db.query(
        `UPDATE public.reports SET status = 'Rejected', rejection_reason = 'Duplicate issue' WHERE id = $1`,
        [reportId1],
      ),
    );
    await expect(
      asAuthenticated(db, COORD_ID, async () =>
        db.query(`UPDATE public.reports SET status = 'Submitted' WHERE id = $1`, [reportId1]),
      ),
    ).rejects.toThrow(/Invalid report status transition/i);

    // Execute supabase/seed.sql under privileged admin context
    const seedSql = fs.readFileSync(seedSqlPath, 'utf8');
    await db.exec(seedSql);

    const seededRows = await db.query<{ idempotency_key: string }>(
      `SELECT idempotency_key FROM public.reports WHERE idempotency_key LIKE 'seed-idem-ft-%' ORDER BY idempotency_key`,
    );
    expect(seededRows.rows.map((r) => r.idempotency_key)).toEqual([
      'seed-idem-ft-0001',
      'seed-idem-ft-0002',
      'seed-idem-ft-0003',
    ]);
  });
});
