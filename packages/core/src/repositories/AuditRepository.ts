/**
 * AuditRepository port. Append-only (docs/security.md §5).
 */
import type { AuditLog } from '../models/index.js';

export interface AuditRepository {
  /** Append a single entry. Never updates or deletes. */
  append(entry: AuditLog): Promise<void>;

  /** Read entries (newest first). For inspection/tests. */
  list(tenantId?: string): Promise<AuditLog[]>;
}
