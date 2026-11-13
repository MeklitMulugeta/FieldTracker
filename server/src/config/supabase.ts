import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../types/api.js';
import { validateServerSupabaseEnv } from './env.js';

export function createSupabaseAdminClient(
  sourceEnv: NodeJS.ProcessEnv = process.env,
): SupabaseClient | null {
  const validation = validateServerSupabaseEnv(sourceEnv);
  if (!validation.isAdminConfigured) {
    return null;
  }

  const supabaseUrl = sourceEnv.SUPABASE_URL!.trim();
  const secretKey = sourceEnv.SUPABASE_SECRET_KEY!.trim();

  return createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createSupabasePublicClient(
  accessToken?: string,
  sourceEnv: NodeJS.ProcessEnv = process.env,
): SupabaseClient {
  const validation = validateServerSupabaseEnv(sourceEnv);
  if (!validation.isConfigured) {
    const missing = validation.missingVars.filter((name) => name !== 'SUPABASE_SECRET_KEY');
    const issues = [...missing, ...validation.invalidVars];
    throw new AppError(
      `Supabase server configuration missing or invalid for: ${issues.join(', ')}`,
      500,
    );
  }

  const supabaseUrl = sourceEnv.SUPABASE_URL!.trim();
  const publishableKey = sourceEnv.SUPABASE_PUBLISHABLE_KEY!.trim();

  return createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });
}

export const supabaseAdmin: SupabaseClient | null = createSupabaseAdminClient();

export function getSupabaseAdminClient(): SupabaseClient {
  if (!supabaseAdmin) {
    const validation = validateServerSupabaseEnv();
    const relevantIssues = [
      ...validation.missingVars.filter((name) => name !== 'SUPABASE_PUBLISHABLE_KEY'),
      ...validation.invalidVars,
    ];
    throw new AppError(
      `Supabase privileged client is not configured. Check server/.env for: ${relevantIssues.join(', ')}`,
      500,
    );
  }
  return supabaseAdmin;
}
