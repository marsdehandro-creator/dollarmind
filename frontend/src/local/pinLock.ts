/**
 * Local app-lock PIN (docs/v1-offline-product-spec.md Decision 6: a PIN-gated
 * lock screen, not full at-rest DB encryption — V1's promise is privacy, not
 * account-grade security). Stored in localStorage, salted + hashed with the
 * same portable sha256Hex used elsewhere — deliberately not the main SQLite
 * DB, so export/import (the data-loss safety net) never has to special-case
 * excluding it, and restoring a backup on a new device never carries over the
 * old device's PIN.
 */
import { sha256Hex } from '@dollarmind/core/utils/hash.js';

const STORAGE_KEY = 'dollarmind.pinLock.v1';

interface StoredPin {
  salt: string;
  hash: string;
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readStored(): StoredPin | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredPin;
  } catch {
    return null;
  }
}

export function isPinSet(): boolean {
  return readStored() !== null;
}

/** Sets or replaces the PIN. Overwriting an existing PIN requires no prior verification here — callers (Settings UI) verify the old PIN themselves first. */
export function setPin(pin: string): void {
  const salt = randomSalt();
  const hash = sha256Hex(salt + pin);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ salt, hash } satisfies StoredPin));
}

export function verifyPin(pin: string): boolean {
  const stored = readStored();
  if (!stored) return false;
  return sha256Hex(stored.salt + pin) === stored.hash;
}

export function clearPin(): void {
  localStorage.removeItem(STORAGE_KEY);
}
