/**
 * On-device (LocalDbDriver-backed) CategoryRepository. Same SQL/shape as
 * SqliteCategoryRepository.
 */
import type { LocalDbDriver } from '../../db/LocalDbDriver.js';
import type { Category } from '../../models/index.js';
import type { CategoryRepository } from '../CategoryRepository.js';
import { rowToCategory, type Row } from '../rowMappers.js';

export class LocalCategoryRepository implements CategoryRepository {
  constructor(private readonly db: LocalDbDriver) {}

  async listByTenant(tenantId: string): Promise<Category[]> {
    const rows = await this.db.query<Row>(
      'SELECT * FROM category WHERE tenant_id = ? AND archived_at IS NULL ORDER BY name ASC',
      [tenantId],
    );
    return rows.map(rowToCategory);
  }

  async findById(id: string): Promise<Category | null> {
    const rows = await this.db.query<Row>('SELECT * FROM category WHERE id = ?', [id]);
    return rows[0] ? rowToCategory(rows[0]) : null;
  }

  async findByName(tenantId: string, name: string): Promise<Category | null> {
    const rows = await this.db.query<Row>('SELECT * FROM category WHERE tenant_id = ? AND name = ?', [
      tenantId,
      name,
    ]);
    return rows[0] ? rowToCategory(rows[0]) : null;
  }
}
