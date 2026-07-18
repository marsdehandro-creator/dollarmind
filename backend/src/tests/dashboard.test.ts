/**
 * DashboardService tests (in-memory SQLite).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createConfiguredDb, type Db } from '../db/index.js';
import { SqliteTransactionRepository } from '../repositories/sqlite/SqliteTransactionRepository.js';
import { SqliteCategoryRepository } from '../repositories/sqlite/SqliteCategoryRepository.js';
import { SqliteManualExpenseRepository } from '../repositories/sqlite/SqliteManualExpenseRepository.js';
import { SqliteCashEntryRepository } from '../repositories/sqlite/SqliteCashEntryRepository.js';
import { SqliteIssueRepository } from '../repositories/sqlite/SqliteIssueRepository.js';
import { SqliteSalarySlipRepository } from '../repositories/sqlite/SqliteSalarySlipRepository.js';
import { SqliteAccountRepository } from '../repositories/sqlite/SqliteAccountRepository.js';
import { SqliteDocumentRepository } from '../repositories/sqlite/SqliteDocumentRepository.js';
import { LocalSpendingSummaryService } from '../services/LocalSpendingSummaryService.js';
import { LocalDashboardService } from '../services/LocalDashboardService.js';
import { DEFAULT_TENANT_ID } from '../config/index.js';
import type { Transaction } from '../models/index.js';
import { newId, nowIso } from '../utils/id.js';

const today = new Date();
const thisMonth = today.toISOString().slice(0, 7);
const d = (day: number) => `${thisMonth}-${String(day).padStart(2, '0')}`;

let accountId = '';
let documentId = '';

async function fixtures(db: Db) {
  const account = await new SqliteAccountRepository(db).getOrCreateBankAccount(DEFAULT_TENANT_ID, 'My Bank');
  accountId = account.id;
  documentId = newId();
  await new SqliteDocumentRepository(db).create({
    id: documentId, tenantId: DEFAULT_TENANT_ID, accountId, docType: 'bank_statement',
    filePath: '/tmp/x.csv', fileHash: newId(), mimeType: 'text/csv', byteSize: 1,
    parserId: null, parseStatus: 'ok', parseMeta: null, uploadedAt: nowIso(), archivedAt: null,
  });
}

function txn(db: Db, opts: { day: number; amount: number; direction: 'debit' | 'credit'; categoryName?: string }) {
  const now = nowIso();
  const cat = opts.categoryName
    ? (db.prepare('SELECT id FROM category WHERE tenant_id=? AND name=?').get(DEFAULT_TENANT_ID, opts.categoryName) as { id: string } | undefined)
    : undefined;
  const t: Transaction = {
    id: newId(), tenantId: DEFAULT_TENANT_ID, accountId, bankStatementId: null, sourceDocumentId: documentId,
    sourceRow: null, txnDate: d(opts.day), descriptionRaw: 'X', descriptionNorm: 'x', amount: opts.amount,
    direction: opts.direction, balanceAfter: null, currency: 'ZAR', categoryId: cat?.id ?? null,
    categorySource: cat ? 'rule' : 'default', merchant: null, confidence: 1, flagged: false, dedupGroupId: null, dedupHash: newId(), reconciledExpenseId: null,
    createdAt: now, updatedAt: now, archivedAt: null,
  };
  return new SqliteTransactionRepository(db).create(t);
}

function makeDashboard(db: Db) {
  const summary = new LocalSpendingSummaryService(
    new SqliteTransactionRepository(db), new SqliteCategoryRepository(db),
    new SqliteManualExpenseRepository(db), new SqliteCashEntryRepository(db),
  );
  return new LocalDashboardService(
    summary, new SqliteTransactionRepository(db), new SqliteManualExpenseRepository(db),
    new SqliteCashEntryRepository(db), new SqliteIssueRepository(db), new SqliteSalarySlipRepository(db),
  );
}

describe('LocalDashboardService', () => {
  let db: Db;
  beforeEach(async () => {
    db = createConfiguredDb(':memory:');
    await fixtures(db);
    await txn(db, { day: 5, amount: 45_000_00, direction: 'credit' });          // income
    await txn(db, { day: 6, amount: 3_000_00, direction: 'debit', categoryName: 'Groceries' });
    await txn(db, { day: 7, amount: 1_000_00, direction: 'debit', categoryName: 'Transport' });
  });

  it('computes overview with savings and burn rates', async () => {
    const ov = await makeDashboard(db).overview(DEFAULT_TENANT_ID);
    expect(ov.income).toBe(45_000_00);
    expect(ov.expense).toBe(4_000_00);
    expect(ov.net).toBe(41_000_00);
    expect(ov.burnRate).toBe(9); // 4000/45000 ~ 8.9 -> 9
    expect(ov.savingsRate).toBe(91);
  });

  it('breaks down categories with a top list', async () => {
    const cat = await makeDashboard(db).categories(DEFAULT_TENANT_ID);
    expect(cat.total).toBe(4_000_00);
    const groceries = cat.items.find((i) => i.name === 'Groceries');
    expect(groceries?.total).toBe(3_000_00);
    expect(groceries?.pct).toBe(75);
    expect(cat.top3.length).toBeGreaterThanOrEqual(2);
  });

  it('returns a cash-flow timeline', async () => {
    const cf = await makeDashboard(db).cashflow(DEFAULT_TENANT_ID, 'monthly');
    expect(cf.period).toBe('monthly');
    expect(cf.points.length).toBe(6);
    const current = cf.points[cf.points.length - 1];
    expect(current.income).toBe(45_000_00);
    expect(current.expense).toBe(4_000_00);
  });

  it('raises a missing-salary-slip alert', async () => {
    const { alerts } = await makeDashboard(db).alerts(DEFAULT_TENANT_ID);
    expect(alerts.some((a) => a.kind === 'missing_salary')).toBe(true);
  });
});
