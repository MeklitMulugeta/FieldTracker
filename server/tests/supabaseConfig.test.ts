import { describe, expect, it } from 'vitest';
import { validateServerSupabaseEnv } from '../src/config/env.js';
import {
  createSupabaseAdminClient,
  createSupabasePublicClient,
} from '../src/config/supabase.js';

describe('server Supabase configuration', () => {
  it('reports missing server env variable names without leaking secrets', () => {
    const result = validateServerSupabaseEnv({});

    expect(result.isConfigured).toBe(false);
    expect(result.isAdminConfigured).toBe(false);
    expect(result.missingVars).toEqual([
      'SUPABASE_URL',
      'SUPABASE_PUBLISHABLE_KEY',
      'SUPABASE_SECRET_KEY',
    ]);
  });

  it('flags invalid SUPABASE_URL format without exposing its value', () => {
    const result = validateServerSupabaseEnv({
      SUPABASE_URL: 'invalid-url-value',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example_placeholder',
      SUPABASE_SECRET_KEY: 'sb_secret_example_placeholder',
    });

    expect(result.isConfigured).toBe(false);
    expect(result.isAdminConfigured).toBe(false);
    expect(result.invalidVars).toEqual(['SUPABASE_URL']);
  });

  it('creates public and admin clients when valid configuration is supplied', () => {
    const testEnv: NodeJS.ProcessEnv = {
      SUPABASE_URL: 'https://example-project.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example_placeholder',
      SUPABASE_SECRET_KEY: 'sb_secret_example_placeholder',
    };

    const adminClient = createSupabaseAdminClient(testEnv);
    const publicClient = createSupabasePublicClient(undefined, testEnv);

    expect(adminClient).not.toBeNull();
    expect(publicClient).toBeDefined();
  });

  it('throws a clear error without credential values when public client is unconfigured', () => {
    expect(() => createSupabasePublicClient(undefined, {})).toThrow(
      /SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY/,
    );
  });
});
