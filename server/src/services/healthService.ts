import { validateServerSupabaseEnv } from '../config/env.js';
import { getSupabaseAdminClient } from '../config/supabase.js';
import type { HealthCheckResponse } from '../types/api.js';

export interface SupabaseRuntimeCheckResponse {
  success: boolean;
  runtimeEnv: {
    supabaseUrlPresent: boolean;
    publishableKeyPresent: boolean;
    secretKeyPresent: boolean;
    missingVars: string[];
    invalidVars: string[];
  };
  connectivity: {
    networkReachable: boolean;
    publishableKeyAccepted: boolean;
    secretKeyAccepted: boolean;
    publishableStatus?: number;
    adminStatus?: number;
    reason?: string;
  };
  timestamp: string;
}

export function getHealthStatus(): HealthCheckResponse {
  return {
    success: true,
    message: 'FieldTrack API is running',
    timestamp: new Date().toISOString(),
  };
}

export async function getSupabaseRuntimeStatus(): Promise<SupabaseRuntimeCheckResponse> {
  const validation = validateServerSupabaseEnv();

  const runtimeEnv = {
    supabaseUrlPresent: !validation.missingVars.includes('SUPABASE_URL'),
    publishableKeyPresent: !validation.missingVars.includes('SUPABASE_PUBLISHABLE_KEY'),
    secretKeyPresent: !validation.missingVars.includes('SUPABASE_SECRET_KEY'),
    missingVars: validation.missingVars,
    invalidVars: validation.invalidVars,
  };

  let networkReachable = false;
  let publishableKeyAccepted = false;
  let secretKeyAccepted = false;
  let publishableStatus: number | undefined;
  let adminStatus: number | undefined;
  let reason: string | undefined;

  if (validation.isConfigured) {
    const supabaseUrl = process.env.SUPABASE_URL!.trim().replace(/\/+$/, '');
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY!.trim();

    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
        method: 'GET',
        headers: {
          apikey: publishableKey,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      });
      networkReachable = true;
      publishableStatus = response.status;
      publishableKeyAccepted = response.ok;
      if (!response.ok) {
        reason = `Publishable key check returned HTTP ${response.status}`;
      }
    } catch (err) {
      reason = err instanceof Error ? `Network check failed (${err.name})` : 'Network check failed';
    }
  } else {
    reason = 'Required Supabase environment variables are missing or invalid in server runtime';
  }

  if (validation.isAdminConfigured) {
    try {
      const adminClient = getSupabaseAdminClient();
      const { error } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      });

      networkReachable = true;
      if (!error) {
        adminStatus = 200;
        secretKeyAccepted = true;
      } else {
        adminStatus = typeof error.status === 'number' ? error.status : 401;
        secretKeyAccepted = false;
        reason = reason ?? `Secret key validation failed (HTTP ${adminStatus})`;
      }
    } catch (err) {
      secretKeyAccepted = false;
      reason =
        reason ??
        (err instanceof Error ? `Admin check failed (${err.name})` : 'Admin check failed');
    }
  }

  return {
    success:
      validation.missingVars.length === 0 &&
      validation.invalidVars.length === 0 &&
      networkReachable &&
      publishableKeyAccepted &&
      secretKeyAccepted,
    runtimeEnv,
    connectivity: {
      networkReachable,
      publishableKeyAccepted,
      secretKeyAccepted,
      ...(publishableStatus !== undefined ? { publishableStatus } : {}),
      ...(adminStatus !== undefined ? { adminStatus } : {}),
      ...(reason ? { reason } : {}),
    },
    timestamp: new Date().toISOString(),
  };
}
