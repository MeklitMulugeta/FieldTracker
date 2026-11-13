import { describe, expect, it } from 'vitest';
import { createClientSupabase, validateClientSupabaseEnv } from './supabase';

describe('client Supabase configuration', () => {
  it('reports missing environment variable names without exposing values', () => {
    const result = validateClientSupabaseEnv({});

    expect(result.isConfigured).toBe(false);
    expect(result.missingVars).toEqual([
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_PUBLISHABLE_KEY',
    ]);
    expect(result.invalidVars).toEqual([]);
  });

  it('flags invalid VITE_SUPABASE_URL without echoing the input string', () => {
    const result = validateClientSupabaseEnv({
      VITE_SUPABASE_URL: 'not-a-valid-url',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example_placeholder',
    });

    expect(result.isConfigured).toBe(false);
    expect(result.missingVars).toEqual([]);
    expect(result.invalidVars).toEqual(['VITE_SUPABASE_URL']);
  });

  it('creates a client instance when valid URL and publishable key are supplied', () => {
    const client = createClientSupabase({
      VITE_SUPABASE_URL: 'https://example-project.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example_placeholder',
    });

    expect(client).not.toBeNull();
  });
});
