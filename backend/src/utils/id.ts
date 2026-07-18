/**
 * ID generation. UUIDs are the PK format across the data model
 * (docs/data-model.md §1). Uses Node's built-in crypto — no dependency.
 */
import { randomUUID } from 'node:crypto';

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
