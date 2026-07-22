/**
 * On-device (LocalDbDriver-backed) SalarySlipRepository. Same SQL/shape as
 * SqliteSalarySlipRepository.
 */
import type { LocalDbDriver } from '../../db/LocalDbDriver.js';
import type { SalarySlip } from '../../models/index.js';
import type { SalarySlipRepository } from '../SalarySlipRepository.js';
import { rowToSalarySlip, type Row } from '../rowMappers.js';

export class LocalSalarySlipRepository implements SalarySlipRepository {
  constructor(private readonly db: LocalDbDriver) {}

  async create(slip: SalarySlip): Promise<SalarySlip> {
    await this.db.run(
      `INSERT INTO salary_slip (id, tenant_id, account_id, source_document_id, period_start,
         period_end, pay_date, gross_amount, net_amount, currency, employer_name, employee_name,
         period_label, notes, confirmed, created_at, updated_at, archived_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        slip.id,
        slip.tenantId,
        slip.accountId,
        slip.sourceDocumentId,
        slip.periodStart,
        slip.periodEnd,
        slip.payDate,
        slip.grossAmount,
        slip.netAmount,
        slip.currency,
        slip.employerName,
        slip.employeeName,
        slip.periodLabel,
        slip.notes,
        slip.confirmed ? 1 : 0,
        slip.createdAt,
        slip.updatedAt,
        slip.archivedAt,
      ],
    );
    return slip;
  }

  async findById(id: string): Promise<SalarySlip | null> {
    const rows = await this.db.query<Row>('SELECT * FROM salary_slip WHERE id = ?', [id]);
    return rows[0] ? rowToSalarySlip(rows[0]) : null;
  }

  async listByTenant(tenantId: string): Promise<SalarySlip[]> {
    const rows = await this.db.query<Row>(
      'SELECT * FROM salary_slip WHERE tenant_id = ? AND archived_at IS NULL ORDER BY created_at DESC',
      [tenantId],
    );
    return rows.map(rowToSalarySlip);
  }
}
