/**
 * IssueRepository port. Data-quality + user-reported issues (docs/requirements.md F7).
 */
import type { IssueLog } from '../models/index.js';

export interface IssueRepository {
  create(issue: IssueLog): Promise<IssueLog>;
  /** Open issues for a tenant, newest first. */
  listByTenant(tenantId: string): Promise<IssueLog[]>;
  listByEntity(tenantId: string, entityType: string, entityId: string): Promise<IssueLog[]>;
}
