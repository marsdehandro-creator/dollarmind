/**
 * Platform dispatcher for the on-device SQL driver: native SQLite on
 * Android/iOS (via @capacitor-community/sqlite), sql.js in the browser
 * (webSqlJsDriver.ts — a more predictable path than jeep-sqlite's bundled
 * wasm loader, which hit a reproducible LinkError in this project's
 * testing). packages/core's repositories and migration runner depend only
 * on the LocalDbDriver interface, never on which of these is active.
 */
import { Capacitor } from '@capacitor/core';
import type { LocalDbDriver } from '@dollarmind/core/db/LocalDbDriver.js';

export async function getLocalDbDriver(): Promise<LocalDbDriver> {
  if (Capacitor.getPlatform() === 'web') {
    const { getWebSqlJsDriver } = await import('./webSqlJsDriver.js');
    return getWebSqlJsDriver();
  }
  const { getNativeSqliteDriver } = await import('./nativeSqliteDriver.js');
  return getNativeSqliteDriver();
}

/**
 * Flushes to durable storage. Required after any execute()-only sequence
 * (the migration runner) — see webSqlJsDriver.ts for why. No-op on native
 * (the real SQLite file is already durable after every write).
 */
export async function persist(): Promise<void> {
  if (Capacitor.getPlatform() !== 'web') return;
  const { persistWebDb } = await import('./webSqlJsDriver.js');
  await persistWebDb();
}
