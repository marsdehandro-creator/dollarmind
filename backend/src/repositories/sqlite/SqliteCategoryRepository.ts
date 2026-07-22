/**
 * SQLite-backed CategoryRepository.
 */
import type { Db } from '../../db/connection.js';
import type { Category } from '@dollarmind/core/models/index.js';
import type { CategoryRepository } from '@dollarmind/core/repositories/CategoryRepository.js';
import { rowToCategory, type Row } from '@dollarmind/core/repositories/rowMappers.js';

export class SqliteCategoryRepository implements CategoryRepository {
  constructor(private readonly db: Db) {}

  async listByTenant(tenantId: string): Promise<Category[]> {
    const rows = this.db
      .prepare('SELECT * FROM category WHERE tenant_id = ? AND archived_at IS NULL ORDER BY name ASC')
      .all(tenantId) as Row[];
    return rows.map(rowToCategory);
  }

  async findById(id: string): Promise<Category | null> {
    const row = this.db.prepare('SELECT * FROM category WHERE id = ?').get(id) as Row | undefined;
    return row ? rowToCategory(row) : null;
  }

  async findByName(tenantId: string, name: string): Promise<Category | null> {
    const row = this.db
      .prepare('SELECT * FROM category WHERE tenant_id = ? AND name = ?')
      .get(tenantId, name) as Row | undefined;
    return row ? rowToCategory(row) : null;
  }
}
