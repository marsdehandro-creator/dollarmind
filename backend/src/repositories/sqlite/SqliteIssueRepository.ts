/**
 * SQLite-backed IssueRepository.
 */
import type { Db } from '../../db/connection.js';
import type { IssueLog } from '@dollarmind/core/models/index.js';
import type { IssueRepository } from '@dollarmind/core/repositories/IssueRepository.js';
import { rowToIssue, type Row } from '@dollarmind/core/repositories/rowMappers.js';

export class SqliteIssueRepository implements IssueRepository {
  constructor(private readonly db: Db) {}

  async create(issue: IssueLog): Promise<IssueLog> {
    this.db
      .prepare(
        `INSERT INTO issue_log (id, tenant_id, source, kind, severity, entity_type, entity_id,
           status, detail, created_at, updated_at, resolved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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
      );
    return issue;
  }

  async listByTenant(tenantId: string): Promise<IssueLog[]> {
    const rows = this.db
      .prepare('SELECT * FROM issue_log WHERE tenant_id = ? ORDER BY created_at DESC')
      .all(tenantId) as Row[];
    return rows.map(rowToIssue);
  }

  async listByEntity(tenantId: string, entityType: string, entityId: string): Promise<IssueLog[]> {
    const rows = this.db
      .prepare(
        'SELECT * FROM issue_log WHERE tenant_id = ? AND entity_type = ? AND entity_id = ? ORDER BY created_at DESC',
      )
      .all(tenantId, entityType, entityId) as Row[];
    return rows.map(rowToIssue);
  }
}
