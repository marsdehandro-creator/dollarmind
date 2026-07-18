/**
 * In-memory AuditRepository (pilot bootstrap). Append-only.
 */
import type { AuditLog } from '../../models/index.js';
import type { AuditRepository } from '../AuditRepository.js';

export class InMemoryAuditRepository implements AuditRepository {
  private readonly entries: AuditLog[] = [];

  async append(entry: AuditLog): Promise<void> {
    this.entries.push(entry);
  }

  async list(tenantId?: string): Promise<AuditLog[]> {
    const rows = tenantId
      ? this.entries.filter((e) => e.tenantId === tenantId)
      : this.entries;
    return [...rows].reverse();
  }
}
