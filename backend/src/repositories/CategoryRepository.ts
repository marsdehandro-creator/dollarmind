/**
 * CategoryRepository port.
 */
import type { Category } from '../models/index.js';

export interface CategoryRepository {
  listByTenant(tenantId: string): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  findByName(tenantId: string, name: string): Promise<Category | null>;
}
