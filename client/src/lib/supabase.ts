import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface ClientSupabaseValidation {
  isConfigured: boolean;
  missingVars: string[];
  invalidVars: string[];
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateClientSupabaseEnv(
  rawEnv: Record<string, string | boolean | undefined> = import.meta.env,
): ClientSupabaseValidation {
  const supabaseUrl =
    typeof rawEnv.VITE_SUPABASE_URL === 'string' ? rawEnv.VITE_SUPABASE_URL.trim() : '';
  const publishableKey =
    typeof rawEnv.VITE_SUPABASE_PUBLISHABLE_KEY === 'string'
      ? rawEnv.VITE_SUPABASE_PUBLISHABLE_KEY.trim()
      : '';

  const missingVars: string[] = [];
  const invalidVars: string[] = [];

  if (!supabaseUrl) {
    missingVars.push('VITE_SUPABASE_URL');
  } else if (!isValidHttpUrl(supabaseUrl)) {
    invalidVars.push('VITE_SUPABASE_URL');
  }

  if (!publishableKey) {
    missingVars.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  }

  return {
    isConfigured: missingVars.length === 0 && invalidVars.length === 0,
    missingVars,
    invalidVars,
  };
}

export function createClientSupabase(
  rawEnv: Record<string, string | boolean | undefined> = import.meta.env,
): SupabaseClient | null {
  const validation = validateClientSupabaseEnv(rawEnv);
  if (!validation.isConfigured) {
    return null;
  }

  const supabaseUrl = (rawEnv.VITE_SUPABASE_URL as string).trim();
  const publishableKey = (rawEnv.VITE_SUPABASE_PUBLISHABLE_KEY as string).trim();

  return createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export function validateClientStartupEnv(): ClientSupabaseValidation {
  const result = validateClientSupabaseEnv();

  if (!result.isConfigured && import.meta.env.MODE !== 'test') {
    const issues: string[] = [];
    if (result.missingVars.length > 0) {
      issues.push(`missing: ${result.missingVars.join(', ')}`);
    }
    if (result.invalidVars.length > 0) {
      issues.push(`invalid URL format: ${result.invalidVars.join(', ')}`);
    }
    console.warn(
      `[FieldTrack Client] Supabase environment configuration is incomplete (${issues.join('; ')}). Create client/.env from client/.env.example to enable Supabase features.`,
    );
  }

  return result;
}

export const supabase: SupabaseClient | null = createClientSupabase();

export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    const validation = validateClientSupabaseEnv();
    const issueNames = [...validation.missingVars, ...validation.invalidVars];
    throw new Error(
      `Supabase client is not configured. Check client/.env for: ${issueNames.join(', ')}`,
    );
  }
  return supabase;
}
