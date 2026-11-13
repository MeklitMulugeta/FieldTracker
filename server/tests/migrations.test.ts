import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDir = path.resolve(process.cwd(), '../supabase/migrations');

function getMigrationFiles(): string[] {
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(migrationsDir, filename), 'utf8');
}

describe('supabase SQL migrations static security verification', () => {
  const files = getMigrationFiles();
  const combinedSql = files.map(readMigration).join('\n');

  it('defines sequential migration files wrapped in BEGIN/COMMIT transactions without destructive SQL', () => {
    expect(files).toEqual([
      '0001_extensions_and_types.sql',
      '0002_create_core_tables.sql',
      '0003_indexes.sql',
      '0004_functions_and_triggers.sql',
      '0005_rls_policies.sql',
      '0006_storage_bucket_and_policies.sql',
    ]);

    for (const file of files) {
      const sql = readMigration(file);
      expect(sql).toMatch(/\bBEGIN;/);
      expect(sql).toMatch(/\bCOMMIT;/);
      expect(sql).not.toMatch(/\bDROP\s+TABLE\b/i);
      expect(sql).not.toMatch(/\bTRUNCATE\b/i);
      expect(sql).not.toMatch(/\bDROP\s+DATABASE\b/i);

      const dollarMatches = sql.match(/\$\$/g) ?? [];
      expect(dollarMatches.length % 2).toBe(0);
    }
  });

  it('creates all five required tables with foreign keys, categories, statuses, and In Progress assignment check', () => {
    const tablesSql = readMigration('0002_create_core_tables.sql');

    for (const table of [
      'public.profiles',
      'public.reports',
      'public.report_attachments',
      'public.report_assignments',
      'public.activity_logs',
    ]) {
      expect(tablesSql).toContain(`CREATE TABLE ${table}`);
    }

    for (const category of [
      'Water Supply',
      'Equipment Damage',
      'Infrastructure Damage',
      'Service Interruption',
      'Safety Concern',
      'Maintenance',
      'Other',
    ]) {
      expect(tablesSql).toContain(`'${category}'`);
    }

    for (const status of [
      'Draft',
      'Submitted',
      'Assigned',
      'In Progress',
      'Resolved',
      'Needs Correction',
      'Rejected',
    ]) {
      expect(tablesSql).toContain(`'${status}'`);
    }

    expect(tablesSql).toContain('CONSTRAINT reports_assigned_worker_required_check CHECK');
    expect(tablesSql).toContain("status NOT IN ('Assigned', 'In Progress') OR assigned_to IS NOT NULL");
    expect(tablesSql).toContain('REFERENCES auth.users(id) ON DELETE CASCADE');
    expect(tablesSql).toContain('REFERENCES public.profiles(id)');
    expect(tablesSql).toContain('REFERENCES public.reports(id) ON DELETE CASCADE');
  });

  it('includes a safe non-destructive backfill for pre-existing auth.users defaulting to worker', () => {
    const functionsSql = readMigration('0004_functions_and_triggers.sql');

    expect(functionsSql).toContain('FROM auth.users AS u');
    expect(functionsSql).toContain('LEFT JOIN public.profiles AS p ON p.id = u.id');
    expect(functionsSql).toContain('WHERE p.id IS NULL');
    expect(functionsSql).toContain('ON CONFLICT (id) DO NOTHING');
    expect(functionsSql).toContain("'worker'");
  });

  it('prevents authenticated users from probing other users via SECURITY DEFINER helpers and enforces SET search_path', () => {
    const functionsSql = readMigration('0004_functions_and_triggers.sql');
    const sqlWithoutComments = functionsSql.replace(/--.*$/gm, '');
    const securityDefinerBlocks = sqlWithoutComments.split('SECURITY DEFINER').slice(1);

    expect(securityDefinerBlocks.length).toBeGreaterThanOrEqual(11);
    for (const block of securityDefinerBlocks) {
      const header = block.slice(0, 60);
      expect(header).toContain("SET search_path = ''");
    }

    // Verify self-scoping guard on parameterized helper functions
    const selfScopeOccurrences = sqlWithoutComments.match(/p_user_id = auth\.uid\(\)/g) ?? [];
    expect(selfScopeOccurrences.length).toBe(3);

    expect(functionsSql).toContain('CREATE OR REPLACE FUNCTION public.is_active_user()');
    expect(functionsSql).toContain('protect_profile_privilege_escalation');
  });

  it('explicitly restricts EXECUTE privileges from PUBLIC and anon on all functions and limits sync RPC to authenticated', () => {
    const functionsSql = readMigration('0004_functions_and_triggers.sql');

    for (const triggerFn of [
      'public.set_updated_at()',
      'public.handle_new_user()',
      'public.protect_profile_privilege_escalation()',
      'public.generate_report_number()',
      'public.enforce_report_workflow()',
      'public.record_report_assignment_history()',
      'public.log_report_activity()',
    ]) {
      expect(functionsSql).toContain(`REVOKE ALL ON FUNCTION ${triggerFn} FROM PUBLIC, anon, authenticated;`);
    }

    for (const helperFn of [
      'public.try_parse_uuid(TEXT)',
      'public.is_active_user()',
      'public.current_user_role()',
      'public.is_coordinator(UUID)',
      'public.can_access_report(UUID, UUID)',
      'public.can_edit_report_evidence(UUID, UUID)',
    ]) {
      expect(functionsSql).toContain(`REVOKE ALL ON FUNCTION ${helperFn} FROM PUBLIC, anon;`);
      expect(functionsSql).toContain(`GRANT EXECUTE ON FUNCTION ${helperFn} TO authenticated, service_role;`);
    }

    expect(functionsSql).toContain('REVOKE ALL ON FUNCTION public.sync_report_idempotent(');
    expect(functionsSql).toMatch(/REVOKE ALL ON FUNCTION public\.sync_report_idempotent\([\s\S]*?\) FROM PUBLIC, anon, service_role;/);
    expect(functionsSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.sync_report_idempotent\([\s\S]*?\) TO authenticated;/);
  });

  it('hardens offline synchronization with schema-qualified UUID generation and conflict guards', () => {
    const tablesSql = readMigration('0002_create_core_tables.sql');
    const indexesSql = readMigration('0003_indexes.sql');
    const functionsSql = readMigration('0004_functions_and_triggers.sql');
    const sqlWithoutComments = functionsSql.replace(/--.*$/gm, '');

    expect(tablesSql).toContain('CONSTRAINT reports_idempotency_key_unique UNIQUE (idempotency_key)');
    expect(tablesSql).toContain('CONSTRAINT reports_report_number_unique UNIQUE (report_number)');
    expect(tablesSql).toContain('client_created_at TIMESTAMPTZ');
    expect(indexesSql).toContain('idx_reports_idempotency_key');
    expect(functionsSql).toContain("nextval('public.report_number_seq')");
    expect(sqlWithoutComments).toContain('CREATE OR REPLACE FUNCTION public.sync_report_idempotent');
    expect(sqlWithoutComments).toContain('SECURITY DEFINER');
    expect(sqlWithoutComments).toContain('Active user profile required for report synchronization');
    expect(sqlWithoutComments).toContain('WHERE p.id = caller_id');
    expect(sqlWithoutComments).toContain('AND p.is_active = true');
    expect(sqlWithoutComments).toContain('IF caller_id IS NULL THEN');
    expect(sqlWithoutComments).toContain('IF existing_by_key.created_by <> caller_id THEN');
    expect(sqlWithoutComments).toContain('IF existing_by_id.created_by <> caller_id THEN');
    expect(sqlWithoutComments).toContain('pg_catalog.gen_random_uuid()');
    expect(sqlWithoutComments).not.toMatch(/[^.]\bgen_random_uuid\(\)/);
    expect(functionsSql).toContain('ON CONFLICT DO NOTHING');
    expect(functionsSql).toContain('Idempotency key is already bound to a different report UUID');
    expect(functionsSql).toContain('Report UUID already exists with a different idempotency_key');
    expect(functionsSql).toContain("IF p_status NOT IN ('Draft', 'Submitted')");
  });

  it('enforces In Progress assigned_to requirement and preserves assignment-history trigger', () => {
    const functionsSql = readMigration('0004_functions_and_triggers.sql');

    expect(functionsSql).toContain("IF NEW.status IN ('Assigned', 'In Progress') AND NEW.assigned_to IS NULL THEN");
    expect(functionsSql).toContain("IF NEW.status = 'Rejected'");
    expect(functionsSql).toContain("IF NEW.status = 'Needs Correction'");
    expect(functionsSql).toContain("WHEN 'Rejected' THEN");
    expect(functionsSql).toContain('transition_allowed := false;');
    expect(functionsSql).toContain('CREATE TRIGGER trg_reports_record_assignment_history');
    expect(functionsSql).toContain('INSERT INTO public.report_assignments');
  });

  it('enforces active-profile checks, blocks direct report/assignment inserts, and keeps history immutable', () => {
    const rlsSql = readMigration('0005_rls_policies.sql');

    expect(rlsSql).toContain('FROM PUBLIC, anon, authenticated;');
    expect(rlsSql).toContain('GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;');
    expect(rlsSql).toContain('GRANT SELECT, UPDATE, DELETE ON TABLE public.reports TO authenticated;');
    expect(rlsSql).not.toMatch(/GRANT[^;]*\bINSERT\b[^;]*ON TABLE public\.reports TO authenticated/i);
    expect(rlsSql).toContain('GRANT SELECT, INSERT, DELETE ON TABLE public.report_attachments TO authenticated;');
    expect(rlsSql).toContain('GRANT SELECT ON TABLE public.report_assignments TO authenticated;');
    expect(rlsSql).not.toMatch(/GRANT[^;]*\bINSERT\b[^;]*ON TABLE public\.report_assignments TO authenticated/i);
    expect(rlsSql).toContain('GRANT SELECT ON TABLE public.activity_logs TO authenticated;');
    expect(rlsSql).toContain('REVOKE ALL ON SEQUENCE public.report_number_seq FROM PUBLIC, anon, authenticated;');

    for (const table of [
      'public.profiles',
      'public.reports',
      'public.report_attachments',
      'public.report_assignments',
      'public.activity_logs',
    ]) {
      expect(rlsSql).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
    }

    // Verify no authenticated INSERT policy exists on public.reports
    expect(rlsSql).not.toContain('reports_insert_authenticated');
    expect(rlsSql).not.toMatch(/CREATE POLICY\s+\w+\s+ON\s+public\.reports\s+FOR\s+INSERT/i);

    // Verify active-profile checks across profile update and all worker report policies
    for (const policyName of [
      'profiles_update_own',
      'reports_select_own_or_assigned',
      'reports_update_worker_editable',
      'reports_delete_own_draft',
    ]) {
      const policyBlockMatch = rlsSql.match(
        new RegExp(`CREATE POLICY ${policyName}[\\s\\S]*?;`),
      );
      expect(policyBlockMatch).not.toBeNull();
      expect(policyBlockMatch![0]).toContain('public.is_active_user()');
    }

    expect(rlsSql).toContain('role = public.current_user_role()');
    expect(rlsSql).not.toMatch(/CREATE POLICY\s+\w+\s+ON\s+public\.activity_logs\s+FOR\s+(INSERT|UPDATE|DELETE)/i);
    expect(rlsSql).not.toMatch(/CREATE POLICY\s+\w+\s+ON\s+public\.report_assignments\s+FOR\s+(INSERT|UPDATE|DELETE)/i);
  });

  it('protects private fieldtrack-evidence bucket without overwriting and inspects storage ownership columns safely', () => {
    const storageSql = readMigration('0006_storage_bucket_and_policies.sql');

    expect(storageSql).toContain("'fieldtrack-evidence'");
    expect(storageSql).not.toMatch(/ON CONFLICT\s*\(id\)\s*DO\s+UPDATE/i);
    expect(storageSql).toContain('ON CONFLICT (id) DO NOTHING');
    expect(storageSql).toContain('Manual security review required');
    expect(storageSql).toContain('CREATE POLICY fieldtrack_evidence_select');
    expect(storageSql).toContain('CREATE POLICY fieldtrack_evidence_insert');
    expect(storageSql).toContain('CREATE POLICY fieldtrack_evidence_delete');
    expect(storageSql).toContain("table_schema = 'storage'");
    expect(storageSql).toContain("column_name = 'owner'");
    expect(storageSql).toContain("column_name = 'owner_id'");
    expect(storageSql).not.toMatch(/CREATE POLICY\s+\w+\s+ON\s+storage\.objects\s+FOR\s+UPDATE/i);
    expect(combinedSql).toContain('public.try_parse_uuid');
  });
});
