/**
 * SQLite-backed SalaryComponentRepository.
 */
import type { Db } from '../../db/connection.js';
import type { SalaryComponent } from '../../models/index.js';
import type { SalaryComponentRepository } from '../SalaryComponentRepository.js';
import { rowToSalaryComponent, type Row } from './rowMappers.js';

export class SqliteSalaryComponentRepository implements SalaryComponentRepository {
  constructor(private readonly db: Db) {}

  async createMany(components: SalaryComponent[]): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT INTO salary_component (id, tenant_id, salary_slip_id, component_type, section, code, label,
         amount, is_taxable, confidence, display_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const c of components) {
      stmt.run(
        c.id,
        c.tenantId,
        c.salarySlipId,
        c.componentType,
        c.section,
        c.code,
        c.label,
        c.amount,
        c.isTaxable === null ? null : c.isTaxable ? 1 : 0,
        c.confidence,
        c.displayOrder,
        c.createdAt,
        c.updatedAt,
      );
    }
  }

  async listBySlip(salarySlipId: string): Promise<SalaryComponent[]> {
    const rows = this.db
      .prepare('SELECT * FROM salary_component WHERE salary_slip_id = ? ORDER BY display_order ASC')
      .all(salarySlipId) as Row[];
    return rows.map(rowToSalaryComponent);
  }
}
