/**
 * On-device (LocalDbDriver-backed) IssueRepository. Same SQL/shape as
 * SqliteIssueRepository.
 */
import type { LocalDbDriver } from '../../db/LocalDbDriver.js';
import type { IssueLog } from '../../models/index.js';
import type { IssueRepository } from '../IssueRepository.js';
import { rowToIssue, type Row } from '../rowMappers.js';

export class LocalIssueRepository implements IssueRepository {
  constructor(private readonly db: LocalDbDriver) {}

  async create(issue: IssueLog): Promise<IssueLog> {
    await this.db.run(
      `INSERT INTO issue_log (id, tenant_id, source, kind, severity, entity_type, entity_id,
         status, detail, created_at, updated_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        issue.id,
        issue.tenantId,
        issue.source,
        issue.kind,
        issue.severity,
        issue.entityType,
        issue.entityId,
        issue.status,
        issue.detail == null ? null : JSON.stringify(issue.detail),
        issue.createdAt,
        issue.updatedAt,
        issue.resolvedAt,
      ],
    );
    return issue;
  }

  async listByTenant(tenantId: string): Promise<IssueLog[]> {
    const rows = await this.db.query<Row>('SELECT * FROM issue_log WHERE tenant_id = ? ORDER BY created_at DESC', [
      tenantId,
    ]);
    return rows.map(rowToIssue);
  }

  async listByEntity(tenantId: string, entityType: string, entityId: string): Promise<IssueLog[]> {
    const rows = await this.db.query<Row>(
      'SELECT * FROM issue_log WHERE tenant_id = ? AND entity_type = ? AND entity_id = ? ORDER BY created_at DESC',
      [tenantId, entityType, entityId],
    );
    return rows.map(rowToIssue);
  }
}
