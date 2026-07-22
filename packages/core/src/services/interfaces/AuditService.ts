/**
 * AuditService port (see docs/security.md §5).
 *
 * Append-only. Records minimized diffs of sensitive actions. Never logs raw
 * financial detail, passwords, tokens, or secrets.
 */
import type { UUID } from '../../models/index.js';

export interface AuditEntry {
  tenantId: UUID;
  actor: string;
  actorRole?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: UUID | null;
  before?: unknown;
  after?: unknown;
  context?: unknown;
}

export interface AuditService {
  /** Append a single audit entry. Never updates or deletes. */
  record(entry: AuditEntry): Promise<void>;
}
