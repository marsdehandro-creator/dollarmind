/**
 * Runtime config loader.
 *
 * Reads the JSON config files under CONFIG_DIR (app-config, category-rules,
 * tax-config, security-policies). Placeholder — returns parsed JSON with no
 * validation yet. Phase 6 adds zod schemas per file.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { env } from './env.js';

function readJson<T>(fileName: string): T {
  const path = join(env.CONFIG_DIR, fileName);
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

export function loadAppConfig(): unknown {
  return readJson('app-config.json');
}

export function loadCategoryRules(): unknown {
  return readJson('category-rules.json');
}

export function loadTaxConfig(): unknown {
  return readJson('tax-config.json');
}

export function loadSecurityPolicies(): unknown {
  return readJson('security-policies.json');
}

export function loadSalaryParserRules<T>(): T {
  return readJson<T>('salary-parser-rules.json');
}

export function loadStatementParserRules<T>(): T {
  return readJson<T>('statement-parser-rules.json');
}

export function loadMerchantRules<T>(): T {
  return readJson<T>('merchant-rules.json');
}
