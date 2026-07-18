/**
 * DashboardAggregationService — resilient, range-driven dashboard (Phase 18).
 * Verifies partial data produces a partial dashboard and never throws.
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
import { LocalDashboardAggregationService } from '../services/LocalDashboardAggregationService.js';
import { DEFAULT_TENANT_ID } from '../config/index.js';
import type { SalarySlip, Transaction } from '../models/index.js';
import { newId, nowIso } from '../utils/id.js';

const FROM = '2026-06-01';
const TO = '2026-06-30';
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

function addSlip(db: Db, net: number, date = '2026-06-25') {
  const now = nowIso();
  const slip: SalarySlip = {
    id: newId(), tenantId: DEFAULT_TENANT_ID, accountId, sourceDocumentId: documentId,
    periodStart: '2026-06-01', periodEnd: '2026-06-30', payDate: date, grossAmount: net + 1_000_000,
    netAmount: net, currency: 'ZAR', employerName: 'ACME', employeeName: 'Jane',
    periodLabel: 'June 2026', notes: null, confirmed: false, createdAt: now, updatedAt: now, archivedAt: null,
  };
  return new SqliteSalarySlipRepository(db).create(slip);
}

function addTxn(db: Db, amount: number, dir: 'debit' | 'credit', catName?: string, day = 10) {
  const cat = catName ? (db.prepare('SELECT id FROM category WHERE tenant_id=? AND name=?').get(DEFAULT_TENANT_ID, catName) as { id: string } | undefined) : undefined;
  const now = nowIso();
  const t: Transaction = {
    id: newId(), tenantId: DEFAULT_TENANT_ID, accountId, bankStatementId: null, sourceDocumentId: documentId,
    sourceRow: null, txnDate: `2026-06-${String(day).padStart(2, '0')}`, descriptionRaw: 'X', descriptionNorm: 'x',
    amount, direction: dir, balanceAfter: null, currency: 'ZAR', categoryId: cat?.id ?? null,
    categorySource: cat ? 'rule' : 'default', merchant: null, confidence: 1, flagged: false,
    dedupGroupId: null, dedupHash: newId(), reconciledExpenseId: null, createdAt: now, updatedAt: now, archivedAt: null,
  };
  return new SqliteTransactionRepository(db).create(t);
}

function makeAgg(db: Db) {
  const summary = new LocalSpendingSummaryService(
    new SqliteTransactionRepository(db), new SqliteCategoryRepository(db),
    new SqliteManualExpenseRepository(db), new SqliteCashEntryRepository(db),
  );
  const dash = new LocalDashboardService(
    summary, new SqliteTransactionRepository(db), new SqliteManualExpenseRepository(db),
    new SqliteCashEntryRepository(db), new SqliteIssueRepository(db), new SqliteSalarySlipRepository(db),
  );
  return new LocalDashboardAggregationService(
    summary, dash, new SqliteSalarySlipRepository(db), new SqliteTransactionRepository(db),
    new SqliteManualExpenseRepository(db), new SqliteCashEntryRepository(db),
  );
}

describe('DashboardAggregationService (resilient)', () => {
  let db: Db;
  beforeEach(async () => {
    db = createConfiguredDb(':memory:');
    await fixtures(db);
  });

  it('salary slip only → income shown, no expenses', async () => {
    addSlip(db, 5_000_000);
    const d = await makeAgg(db).getDashboard(DEFAULT_TENANT_ID, FROM, TO);
    expect(d.hasData).toBe(true);
    expect(d.income).toBe(5_000_000);
    expect(d.expense).toBe(0);
    expect(d.net).toBe(5_000_000);
    expect(d.savingsRate).toBe(100);
  });

  it('transactions only → expenses shown, no income', async () => {
    addTxn(db, 300000, 'debit', 'Groceries');
    const d = await makeAgg(db).getDashboard(DEFAULT_TENANT_ID, FROM, TO);
    expect(d.hasData).toBe(true);
    expect(d.income).toBe(0);
    expect(d.expense).toBe(300000);
    expect(d.net).toBe(-300000);
    expect(d.categories.length).toBeGreaterThan(0);
  });

  it('both → full dashboard with correct rates', async () => {
    addSlip(db, 4_500_000);
    addTxn(db, 300000, 'debit', 'Groceries');
    addTxn(db, 100000, 'debit', 'Transport');
    const d = await makeAgg(db).getDashboard(DEFAULT_TENANT_ID, FROM, TO);
    expect(d.income).toBe(4_500_000);
    expect(d.expense).toBe(400000);
    expect(d.net).toBe(4_100_000);
    expect(d.burnRate).toBe(9);
    expect(d.savingsRate).toBe(91);
    expect(d.cashflow.points.length).toBeGreaterThan(0);
  });

  it('no data in range → hasData false, no throw', async () => {
    addTxn(db, 300000, 'debit', 'Groceries', 10); // June
    const d = await makeAgg(db).getDashboard(DEFAULT_TENANT_ID, '2020-01-01', '2020-12-31');
    expect(d.hasData).toBe(false);
    expect(d.income).toBe(0);
    expect(d.expense).toBe(0);
  });

  it('picks daily/weekly/monthly granularity by span', async () => {
    const agg = makeAgg(db);
    expect((await agg.getCashflow(DEFAULT_TENANT_ID, '2026-06-01', '2026-06-20')).granularity).toBe('daily');
    expect((await agg.getCashflow(DEFAULT_TENANT_ID, '2026-01-01', '2026-04-30')).granularity).toBe('weekly');
    expect((await agg.getCashflow(DEFAULT_TENANT_ID, '2025-01-01', '2026-06-30')).granularity).toBe('monthly');
  });
});
