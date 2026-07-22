/**
 * On-device (LocalDbDriver-backed) SalaryComponentRepository. Same SQL/shape
 * as SqliteSalaryComponentRepository (each component is inserted individually
 * rather than via a reused prepared statement, since the driver contract is
 * per-call — functionally identical).
 */
import type { LocalDbDriver } from '../../db/LocalDbDriver.js';
import type { SalaryComponent } from '../../models/index.js';
import type { SalaryComponentRepository } from '../SalaryComponentRepository.js';
import { rowToSalaryComponent, type Row } from '../rowMappers.js';

const INSERT_SQL = `INSERT INTO salary_component (id, tenant_id, salary_slip_id, component_type, section, code, label,
  amount, is_taxable, confidence, display_order, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export class LocalSalaryComponentRepository implements SalaryComponentRepository {
  constructor(private readonly db: LocalDbDriver) {}

  async createMany(components: SalaryComponent[]): Promise<void> {
    for (const c of components) {
      await this.db.run(INSERT_SQL, [
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
      ]);
    }
  }

  async listBySlip(salarySlipId: string): Promise<SalaryComponent[]> {
    const rows = await this.db.query<Row>(
      'SELECT * FROM salary_component WHERE salary_slip_id = ? ORDER BY display_order ASC',
      [salarySlipId],
    );
    return rows.map(rowToSalaryComponent);
  }
}
