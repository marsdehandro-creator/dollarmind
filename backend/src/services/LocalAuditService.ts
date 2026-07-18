/**
 * LocalAuditService — pilot implementation of the AuditService port.
 * Appends minimized entries to the audit repository (docs/security.md §5).
 */
import type { AuditEntry, AuditService } from './interfaces/AuditService.js';
import type { AuditRepository } from '../repositories/AuditRepository.js';
import type { AuditLog } from '../models/index.js';
import { newId, nowIso } from '../utils/id.js';
import { logger } from '../utils/logger.js';

export class LocalAuditService implements AuditService {
  constructor(private readonly repo: AuditRepository) {}

  async record(entry: AuditEntry): Promise<void> {
    const row: AuditLog = {
      id: newId(),
      tenantId: entry.tenantId,
      actor: entry.actor,
      actorRole: entry.actorRole ?? null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      context: entry.context ?? null,
      at: nowIso(),
    };
    await this.repo.append(row);
    logger.info(`audit: ${row.action}`, { actor: row.actor, entityId: row.entityId });
  }
}
