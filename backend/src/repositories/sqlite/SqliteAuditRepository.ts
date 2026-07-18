/**
 * SQLite-backed AuditRepository. Append-only (docs/security.md §5).
 */
import type { Db } from '../../db/connection.js';
import type { AuditLog } from '../../models/index.js';
import type { AuditRepository } from '../AuditRepository.js';
import { rowToAudit, type Row } from './rowMappers.js';

const j = (v: unknown): string | null => (v == null ? null : JSON.stringify(v));

export class SqliteAuditRepository implements AuditRepository {
  constructor(private readonly db: Db) {}

  async append(entry: AuditLog): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO audit_log (id, tenant_id, actor, actor_role, action, entity_type,
           entity_id, before, after, context, at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        entry.tenantId,
        entry.actor,
        entry.actorRole,
        entry.action,
        entry.entityType,
        entry.entityId,
        j(entry.before),
        j(entry.after),
        j(entry.context),
        entry.at,
      );
  }

  async list(tenantId?: string): Promise<AuditLog[]> {
    const rows = (
      tenantId
        ? this.db.prepare('SELECT * FROM audit_log WHERE tenant_id = ? ORDER BY at DESC').all(tenantId)
        : this.db.prepare('SELECT * FROM audit_log ORDER BY at DESC').all()
    ) as Row[];
    return rows.map(rowToAudit);
  }
}
