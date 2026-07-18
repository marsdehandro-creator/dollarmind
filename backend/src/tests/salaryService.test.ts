/**
 * SalarySlipService integration test against an in-memory SQLite database
 * (migrated + bootstrapped). Exercises upload -> parse -> persist -> history.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createConfiguredDb, type Db } from '../db/index.js';
import { SqliteAccountRepository } from '../repositories/sqlite/SqliteAccountRepository.js';
import { SqliteDocumentRepository } from '../repositories/sqlite/SqliteDocumentRepository.js';
import { SqliteSalarySlipRepository } from '../repositories/sqlite/SqliteSalarySlipRepository.js';
import { SqliteSalaryComponentRepository } from '../repositories/sqlite/SqliteSalaryComponentRepository.js';
import { SqliteIssueRepository } from '../repositories/sqlite/SqliteIssueRepository.js';
import { SqliteAuditRepository } from '../repositories/sqlite/SqliteAuditRepository.js';
import { LocalAuditService } from '../services/LocalAuditService.js';
import { LocalSalarySlipService } from '../services/LocalSalarySlipService.js';
import { DEFAULT_TENANT_ID } from '../config/index.js';

const SAMPLE = `ACME Payroll
Pay Period: 2026-06-01 to 2026-06-30
Basic Salary        45000.00
Gross Pay           45000.00
PAYE                 9000.00
UIF                   177.12
Pension              2250.00
Net Pay             33572.88
`;

function makeService(db: Db) {
  return new LocalSalarySlipService({
    accounts: new SqliteAccountRepository(db),
    documents: new SqliteDocumentRepository(db),
    slips: new SqliteSalarySlipRepository(db),
    components: new SqliteSalaryComponentRepository(db),
    issues: new SqliteIssueRepository(db),
    audit: new LocalAuditService(new SqliteAuditRepository(db)),
  });
}

function textFile(content: string) {
  const buffer = Buffer.from(content, 'utf-8');
  return { buffer, originalName: 'payslip.txt', mimeType: 'text/plain', size: buffer.length };
}

describe('LocalSalarySlipService', () => {
  let db: Db;
  beforeEach(() => {
    db = createConfiguredDb(':memory:');
  });

  it('uploads a text slip and persists gross/net/components', async () => {
    const service = makeService(db);
    const result = await service.uploadSlip({ tenantId: DEFAULT_TENANT_ID, file: textFile(SAMPLE) });

    expect(result.parseStatus).toBe('ok');
    expect(result.slip.grossAmount).toBe(4500000);
    expect(result.slip.netAmount).toBe(3357288);
    expect(result.components.length).toBeGreaterThanOrEqual(4);
    expect(result.issues.length).toBe(0);
  });

  it('returns slip history newest-first with components', async () => {
    const service = makeService(db);
    await service.uploadSlip({ tenantId: DEFAULT_TENANT_ID, file: textFile(SAMPLE) });
    const history = await service.getSlipHistory(DEFAULT_TENANT_ID);
    expect(history.length).toBe(1);
    expect(history[0].components.length).toBeGreaterThanOrEqual(4);
  });

  it('raises a business error for a corrupt/unreadable PDF upload', async () => {
    const service = makeService(db);
    const pdf = { buffer: Buffer.from([0x25, 0x50, 0x44, 0x46]), originalName: 'slip.pdf', mimeType: 'application/pdf', size: 4 };
    await expect(service.uploadSlip({ tenantId: DEFAULT_TENANT_ID, file: pdf })).rejects.toMatchObject({
      code: 'EXTRACTION_FAILED',
      status: 500,
    });
  });

  it('raises MISSING_FIELDS when a text slip has no gross/net', async () => {
    const service = makeService(db);
    const buffer = Buffer.from('Some notes but no pay figures at all', 'utf-8');
    await expect(
      service.uploadSlip({ tenantId: DEFAULT_TENANT_ID, file: { buffer, originalName: 'x.txt', mimeType: 'text/plain', size: buffer.length } }),
    ).rejects.toMatchObject({ code: 'MISSING_FIELDS', status: 422 });
  });
});
