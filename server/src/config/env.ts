import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SERVER_PORT: z.coerce.number().int().positive().optional(),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  SUPABASE_URL: z.string().optional().default(''),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional().default(''),
  SUPABASE_SECRET_KEY: z.string().optional().default(''),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const invalidKeys = Object.keys(parsedEnv.error.flatten().fieldErrors);
  console.error(
    `[FieldTrack Server] Invalid environment configuration for keys: ${invalidKeys.join(', ')}`,
  );
  process.exit(1);
}

const validatedEnv = parsedEnv.data;

export interface ServerSupabaseEnvValidation {
  isConfigured: boolean;
  isAdminConfigured: boolean;
  missingVars: string[];
  invalidVars: string[];
}

export function validateServerSupabaseEnv(
  sourceEnv: NodeJS.ProcessEnv = process.env,
): ServerSupabaseEnvValidation {
  const url = sourceEnv.SUPABASE_URL?.trim() ?? '';
  const publishableKey = sourceEnv.SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
  const secretKey = sourceEnv.SUPABASE_SECRET_KEY?.trim() ?? '';

  const missingVars: string[] = [];
  const invalidVars: string[] = [];

  if (!url) {
    missingVars.push('SUPABASE_URL');
  } else if (!isValidHttpUrl(url)) {
    invalidVars.push('SUPABASE_URL');
  }

  if (!publishableKey) {
    missingVars.push('SUPABASE_PUBLISHABLE_KEY');
  }

  if (!secretKey) {
    missingVars.push('SUPABASE_SECRET_KEY');
  }

  return {
    isConfigured: Boolean(url && isValidHttpUrl(url) && publishableKey),
    isAdminConfigured: Boolean(url && isValidHttpUrl(url) && secretKey),
    missingVars,
    invalidVars,
  };
}

export function assertServerStartupEnv(): ServerSupabaseEnvValidation {
  const validation = validateServerSupabaseEnv();

  if (validation.invalidVars.length > 0) {
    throw new Error(
      `[FieldTrack Server] Invalid URL format for environment variable(s): ${validation.invalidVars.join(', ')}`,
    );
  }

  if (validation.missingVars.length > 0 && validatedEnv.NODE_ENV !== 'test') {
    console.warn(
      `[FieldTrack Server] Supabase environment configuration incomplete (missing: ${validation.missingVars.join(', ')}). Copy server/.env.example to server/.env and populate your project credentials.`,
    );
  }

  return validation;
}

export const env = {
  nodeEnv: validatedEnv.NODE_ENV,
  port: validatedEnv.SERVER_PORT ?? validatedEnv.PORT,
  clientOrigin: validatedEnv.CLIENT_ORIGIN,
  allowedOrigins: Array.from(
    new Set([
      ...validatedEnv.CLIENT_ORIGIN.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
      'http://localhost:3000',
      'http://localhost:5173',
    ]),
  ),
  supabaseConfigured: validateServerSupabaseEnv().isConfigured,
};
