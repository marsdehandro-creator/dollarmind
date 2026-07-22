/**
 * SpendingSummaryService tests (in-memory SQLite).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createConfiguredDb, type Db } from '../db/index.js';
import { SqliteTransactionRepository } from '../repositories/sqlite/SqliteTransactionRepository.js';
import { SqliteCategoryRepository } from '../repositories/sqlite/SqliteCategoryRepository.js';
import { SqliteAccountRepository } from '../repositories/sqlite/SqliteAccountRepository.js';
import { SqliteDocumentRepository } from '../repositories/sqlite/SqliteDocumentRepository.js';
import { SqliteManualExpenseRepository } from '../repositories/sqlite/SqliteManualExpenseRepository.js';
import { SqliteCashEntryRepository } from '../repositories/sqlite/SqliteCashEntryRepository.js';
import { LocalSpendingSummaryService } from '@dollarmind/core/services/LocalSpendingSummaryService.js';
import { DEFAULT_TENANT_ID } from '../config/index.js';
import type { Document, Transaction } from '@dollarmind/core/models/index.js';
import { newId, nowIso } from '@dollarmind/core/utils/id.js';

let accountId = '';
let documentId = '';

async function setupFixtures(db: Db): Promise<void> {
  const account = await new SqliteAccountRepository(db).getOrCreateBankAccount(DEFAULT_TENANT_ID, 'My Bank');
  accountId = account.id;
  documentId = newId();
  const doc: Document = {
    id: documentId,
    tenantId: DEFAULT_TENANT_ID,
    accountId,
    docType: 'bank_statement',
    filePath: '/tmp/x.csv',
    fileHash: newId(),
    mimeType: 'text/csv',
    byteSize: 1,
    parserId: null,
    parseStatus: 'ok',
    parseMeta: null,
    uploadedAt: nowIso(),
    archivedAt: null,
    blobData: null,
  };
  await new SqliteDocumentRepository(db).create(doc);
}

async function seedTxn(
  db: Db,
  opts: { date: string; amount: number; direction: 'debit' | 'credit'; categoryName?: string },
): Promise<void> {
  const cats = new SqliteCategoryRepository(db);
  const categoryId = opts.categoryName ? (await cats.findByName(DEFAULT_TENANT_ID, opts.categoryName))!.id : null;
  const now = nowIso();
  const txn: Transaction = {
    id: newId(),
    tenantId: DEFAULT_TENANT_ID,
    accountId,
    bankStatementId: null,
    sourceDocumentId: documentId,
    sourceRow: null,
    txnDate: opts.date,
    descriptionRaw: 'X',
    descriptionNorm: 'x',
    amount: opts.amount,
    direction: opts.direction,
    balanceAfter: null,
    currency: 'ZAR',
    categoryId,
    categorySource: categoryId ? 'rule' : 'default',
    merchant: null,
    confidence: 1,
    flagged: false,
    dedupGroupId: null,
    dedupHash: newId(),
    reconciledExpenseId: null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  new SqliteTransactionRepository(db).create(txn);
}

describe('LocalSpendingSummaryService', () => {
  let db: Db;
  let svc: LocalSpendingSummaryService;
  beforeEach(async () => {
    db = createConfiguredDb(':memory:');
    await setupFixtures(db);
    svc = new LocalSpendingSummaryService(
      new SqliteTransactionRepository(db),
      new SqliteCategoryRepository(db),
      new SqliteManualExpenseRepository(db),
      new SqliteCashEntryRepository(db),
    );
    // May: 3000 groceries + 1000 transport expense, 45000 income.
    await seedTxn(db, { date: '2026-05-05', amount: 300000, direction: 'debit', categoryName: 'Groceries' });
    await seedTxn(db, { date: '2026-05-06', amount: 100000, direction: 'debit', categoryName: 'Transport' });
    await seedTxn(db, { date: '2026-05-25', amount: 4500000, direction: 'credit', categoryName: 'Income' });
    // June: 2000 groceries expense.
    await seedTxn(db, { date: '2026-06-05', amount: 200000, direction: 'debit', categoryName: 'Groceries' });
  });

  it('computes income/expense/net and category totals', async () => {
    const summary = await svc.monthlySummary(DEFAULT_TENANT_ID);
    expect(summary.income).toBe(4500000);
    expect(summary.expense).toBe(600000); // 3000 + 1000 + 2000
    expect(summary.net).toBe(3900000);
    const groceries = summary.byCategory.find((c) => c.categoryName === 'Groceries');
    expect(groceries?.total).toBe(500000); // 3000 + 2000
  });

  it('averages expense across months present', async () => {
    const summary = await svc.monthlySummary(DEFAULT_TENANT_ID);
    // Two months (May, June): 6000 / 2 = 3000.
    expect(summary.averageMonthlyExpense).toBe(300000);
  });

  it('respects a date range', async () => {
    const june = await svc.monthlySummary(DEFAULT_TENANT_ID, '2026-06-01', '2026-06-30');
    expect(june.expense).toBe(200000);
    expect(june.income).toBe(0);
  });

  it('produces month-over-month trends', async () => {
    const trends = await svc.trends(DEFAULT_TENANT_ID, 6);
    expect(trends.months).toEqual(['2026-05', '2026-06']);
    expect(trends.expenseByMonth).toEqual([400000, 200000]);
    expect(trends.incomeByMonth).toEqual([4500000, 0]);
    expect(trends.categories.length).toBeGreaterThan(0);
  });
});
