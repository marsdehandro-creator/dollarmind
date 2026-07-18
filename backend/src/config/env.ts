/**
 * Environment variable loading and validation for DollarMind.
 *
 * App-specific variables use the DOLLARMIND_ prefix. Legacy unprefixed names are
 * still read as a fallback so existing setups keep working.
 */
function pick(name: string, ...fallbacks: string[]): string | undefined {
  for (const key of [`DOLLARMIND_${name}`, ...fallbacks]) {
    const v = process.env[key];
    if (v !== undefined && v !== '') return v;
  }
  return undefined;
}

export interface Env {
  NODE_ENV: string;
  PORT: number;
  DATABASE_PATH: string;
  CONFIG_DIR: string;
  /** Secret used to sign JWTs. MUST be overridden in any real environment. */
  JWT_SECRET: string;
  /** Access token lifetime in seconds. */
  JWT_EXPIRES_IN: number;
}

export const env: Env = {
  NODE_ENV: pick('ENV', 'NODE_ENV') ?? 'development',
  PORT: Number(pick('PORT', 'PORT') ?? 4000),
  DATABASE_PATH: pick('DATABASE_PATH', 'DATABASE_PATH') ?? '../db/dollarmind.db',
  CONFIG_DIR: pick('CONFIG_DIR', 'CONFIG_DIR') ?? '../config',
  JWT_SECRET: pick('JWT_SECRET', 'JWT_SECRET') ?? 'dev-only-insecure-secret-change-me',
  JWT_EXPIRES_IN: Number(pick('JWT_EXPIRES_IN', 'JWT_EXPIRES_IN') ?? 3600),
};

/** Single-tenant pilot: every user belongs to this tenant (docs/data-model.md §1). */
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
