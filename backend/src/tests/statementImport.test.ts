/**
 * StatementImportService integration test (in-memory SQLite). Covers import,
 * file-level dedup, exact dedup on re-upload of overlapping rows, and filtering.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createConfiguredDb, type Db } from '../db/index.js';
import { SqliteAccountRepository } from '../repositories/sqlite/SqliteAccountRepository.js';
import { SqliteDocumentRepository } from '../repositories/sqlite/SqliteDocumentRepository.js';
import { SqliteBankStatementRepository } from '../repositories/sqlite/SqliteBankStatementRepository.js';
import { SqliteTransactionRepository } from '../repositories/sqlite/SqliteTransactionRepository.js';
import { SqliteIssueRepository } from '../repositories/sqlite/SqliteIssueRepository.js';
import { SqliteAuditRepository } from '../repositories/sqlite/SqliteAuditRepository.js';
import { SqliteCategoryRepository } from '../repositories/sqlite/SqliteCategoryRepository.js';
import { SqliteCategoryRuleRepository } from '../repositories/sqlite/SqliteCategoryRuleRepository.js';
import { SqliteMerchantRuleRepository } from '../repositories/sqlite/SqliteMerchantRuleRepository.js';
import { LocalAuditService } from '../services/LocalAuditService.js';
import { LocalCategorizationService } from '../services/LocalCategorizationService.js';
import { MerchantDetectionService } from '../services/MerchantDetectionService.js';
import { MerchantCategorizationService } from '../services/MerchantCategorizationService.js';
import { LocalDeduplicationService } from '../services/LocalDeduplicationService.js';
import { LocalStatementImportService } from '../services/LocalStatementImportService.js';
import { LocalTransactionService } from '../services/LocalTransactionService.js';
import { DEFAULT_TENANT_ID } from '../config/index.js';

const CSV_A = `Date,Description,Amount,Balance
2026-06-01,WOOLWORTHS SANDTON,-350.00,10000.00
2026-06-02,SALARY ACME,45000.00,55000.00
2026-06-03,UBER TRIP,-120.50,54879.50
`;

// Overlaps CSV_A on the first two rows, adds one new row.
const CSV_B = `Date,Description,Amount,Balance
2026-06-01,WOOLWORTHS SANDTON,-350.00,10000.00
2026-06-02,SALARY ACME,45000.00,55000.00
2026-06-04,NETFLIX,-199.00,54680.50
`;

function makeImport(db: Db) {
  return new LocalStatementImportService({
    accounts: new SqliteAccountRepository(db),
    documents: new SqliteDocumentRepository(db),
    statements: new SqliteBankStatementRepository(db),
    transactions: new SqliteTransactionRepository(db),
    issues: new SqliteIssueRepository(db),
    merchantCategorizer: new MerchantCategorizationService(
      new SqliteMerchantRuleRepository(db),
      new SqliteCategoryRepository(db),
      new SqliteCategoryRuleRepository(db),
      new MerchantDetectionService(),
      new LocalCategorizationService(new SqliteCategoryRuleRepository(db)),
    ),
    dedup: new LocalDeduplicationService(),
    audit: new LocalAuditService(new SqliteAuditRepository(db)),
  });
}

function file(content: string, name = 'stmt.csv') {
  const buffer = Buffer.from(content, 'utf-8');
  return { buffer, originalName: name, mimeType: 'text/csv', size: buffer.length };
}

describe('LocalStatementImportService', () => {
  let db: Db;
  beforeEach(() => {
    db = createConfiguredDb(':memory:');
  });

  it('imports CSV rows and normalizes direction', async () => {
    const svc = makeImport(db);
    const result = await svc.uploadStatement({ tenantId: DEFAULT_TENANT_ID, file: file(CSV_A) });
    expect(result.parseStatus).toBe('ok');
    expect(result.imported).toBe(3);
    expect(result.duplicatesSkipped).toBe(0);
  });

  it('short-circuits an identical file (file-level dedup)', async () => {
    const svc = makeImport(db);
    await svc.uploadStatement({ tenantId: DEFAULT_TENANT_ID, file: file(CSV_A) });
    const again = await svc.uploadStatement({ tenantId: DEFAULT_TENANT_ID, file: file(CSV_A) });
    expect(again.fileAlreadyImported).toBe(true);
    expect(again.imported).toBe(0);
  });

  it('skips exact-duplicate rows when overlapping statements are imported', async () => {
    const svc = makeImport(db);
    await svc.uploadStatement({ tenantId: DEFAULT_TENANT_ID, file: file(CSV_A, 'a.csv') });
    const second = await svc.uploadStatement({ tenantId: DEFAULT_TENANT_ID, file: file(CSV_B, 'b.csv') });
    expect(second.imported).toBe(1); // only NETFLIX is new
    expect(second.duplicatesSkipped).toBe(2); // WOOLWORTHS + SALARY already present

    const txns = new LocalTransactionService(new SqliteTransactionRepository(db));
    const all = await txns.list(DEFAULT_TENANT_ID);
    expect(all).toHaveLength(4); // 3 + 1, no double-count
  });

  it('filters transactions by merchant and direction', async () => {
    const svc = makeImport(db);
    await svc.uploadStatement({ tenantId: DEFAULT_TENANT_ID, file: file(CSV_A) });
    const txns = new LocalTransactionService(new SqliteTransactionRepository(db));

    const woolies = await txns.filter(DEFAULT_TENANT_ID, { merchant: 'woolworths' });
    expect(woolies).toHaveLength(1);

    const credits = await txns.filter(DEFAULT_TENANT_ID, { direction: 'credit' });
    expect(credits).toHaveLength(1);
    expect(credits[0].descriptionRaw).toContain('SALARY');
  });
});
