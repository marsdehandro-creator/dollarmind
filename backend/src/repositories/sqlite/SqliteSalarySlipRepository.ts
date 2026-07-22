/**
 * SQLite-backed SalarySlipRepository.
 */
import type { Db } from '../../db/connection.js';
import type { SalarySlip } from '@dollarmind/core/models/index.js';
import type { SalarySlipRepository } from '@dollarmind/core/repositories/SalarySlipRepository.js';
import { rowToSalarySlip, type Row } from '@dollarmind/core/repositories/rowMappers.js';

export class SqliteSalarySlipRepository implements SalarySlipRepository {
  constructor(private readonly db: Db) {}

  async create(slip: SalarySlip): Promise<SalarySlip> {
    this.db
      .prepare(
        `INSERT INTO salary_slip (id, tenant_id, account_id, source_document_id, period_start,
           period_end, pay_date, gross_amount, net_amount, currency, employer_name, employee_name,
           period_label, notes, confirmed, created_at, updated_at, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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
      );
    return slip;
  }

  async findById(id: string): Promise<SalarySlip | null> {
    const row = this.db.prepare('SELECT * FROM salary_slip WHERE id = ?').get(id) as Row | undefined;
    return row ? rowToSalarySlip(row) : null;
  }

  async listByTenant(tenantId: string): Promise<SalarySlip[]> {
    const rows = this.db
      .prepare('SELECT * FROM salary_slip WHERE tenant_id = ? AND archived_at IS NULL ORDER BY created_at DESC')
      .all(tenantId) as Row[];
    return rows.map(rowToSalarySlip);
  }
}
