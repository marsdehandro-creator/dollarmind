/**
 * On-device (LocalDbDriver-backed) AuditRepository. Append-only, same
 * SQL/shape as SqliteAuditRepository.
 */
import type { LocalDbDriver } from '../../db/LocalDbDriver.js';
import type { AuditLog } from '../../models/index.js';
import type { AuditRepository } from '../AuditRepository.js';
import { rowToAudit, type Row } from '../rowMappers.js';

const j = (v: unknown): string | null => (v == null ? null : JSON.stringify(v));

export class LocalAuditRepository implements AuditRepository {
  constructor(private readonly db: LocalDbDriver) {}

  async append(entry: AuditLog): Promise<void> {
    await this.db.run(
      `INSERT INTO audit_log (id, tenant_id, actor, actor_role, action, entity_type,
         entity_id, before, after, context, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ],
    );
  }

  async list(tenantId?: string): Promise<AuditLog[]> {
    const rows = tenantId
      ? await this.db.query<Row>('SELECT * FROM audit_log WHERE tenant_id = ? ORDER BY at DESC', [tenantId])
      : await this.db.query<Row>('SELECT * FROM audit_log ORDER BY at DESC');
    return rows.map(rowToAudit);
  }
}
