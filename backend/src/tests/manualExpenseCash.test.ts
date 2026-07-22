/**
 * Manual expense + cash entry services, and their integration into spending
 * summaries (in-memory SQLite).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createConfiguredDb, type Db } from '../db/index.js';
import { SqliteTransactionRepository } from '../repositories/sqlite/SqliteTransactionRepository.js';
import { SqliteCategoryRepository } from '../repositories/sqlite/SqliteCategoryRepository.js';
import { SqliteManualExpenseRepository } from '../repositories/sqlite/SqliteManualExpenseRepository.js';
import { SqliteCashEntryRepository } from '../repositories/sqlite/SqliteCashEntryRepository.js';
import { SqliteAuditRepository } from '../repositories/sqlite/SqliteAuditRepository.js';
import { LocalAuditService } from '@dollarmind/core/services/LocalAuditService.js';
import { LocalManualExpenseService } from '@dollarmind/core/services/LocalManualExpenseService.js';
import { LocalCashEntryService } from '@dollarmind/core/services/LocalCashEntryService.js';
import { LocalSpendingSummaryService } from '@dollarmind/core/services/LocalSpendingSummaryService.js';
import { DEFAULT_TENANT_ID } from '../config/index.js';

function services(db: Db) {
  const audit = new LocalAuditService(new SqliteAuditRepository(db));
  return {
    expenses: new LocalManualExpenseService(new SqliteManualExpenseRepository(db), audit),
    cash: new LocalCashEntryService(new SqliteCashEntryRepository(db), audit),
    summary: new LocalSpendingSummaryService(
      new SqliteTransactionRepository(db),
      new SqliteCategoryRepository(db),
      new SqliteManualExpenseRepository(db),
      new SqliteCashEntryRepository(db),
    ),
  };
}

describe('ManualExpenseService', () => {
  let db: Db;
  beforeEach(() => {
    db = createConfiguredDb(':memory:');
  });

  it('creates, updates, lists, and soft-deletes an expense', async () => {
    const { expenses } = services(db);
    const created = await expenses.create(DEFAULT_TENANT_ID, { txnDate: '2026-06-01', amount: 5000, note: 'lunch' });
    expect(created.amount).toBe(5000);

    const updated = await expenses.update(DEFAULT_TENANT_ID, created.id, { amount: 7500 });
    expect(updated.amount).toBe(7500);

    expect(await expenses.list(DEFAULT_TENANT_ID)).toHaveLength(1);

    await expenses.delete(DEFAULT_TENANT_ID, created.id);
    expect(await expenses.list(DEFAULT_TENANT_ID)).toHaveLength(0); // archived, hidden from list
  });

  it('rejects a non-positive amount', async () => {
    const { expenses } = services(db);
    await expect(expenses.create(DEFAULT_TENANT_ID, { txnDate: '2026-06-01', amount: 0 })).rejects.toThrow();
  });
});

describe('CashEntryService', () => {
  let db: Db;
  beforeEach(() => {
    db = createConfiguredDb(':memory:');
  });

  it('records inflow and outflow entries', async () => {
    const { cash } = services(db);
    await cash.create(DEFAULT_TENANT_ID, { entryDate: '2026-06-01', direction: 'inflow', amount: 10000 });
    await cash.create(DEFAULT_TENANT_ID, { entryDate: '2026-06-02', direction: 'outflow', amount: 3000 });
    const list = await cash.list(DEFAULT_TENANT_ID);
    expect(list).toHaveLength(2);
  });
});

describe('spending summary integration', () => {
  let db: Db;
  beforeEach(() => {
    db = createConfiguredDb(':memory:');
  });

  it('includes manual expenses and cash entries in totals + category breakdown', async () => {
    const { expenses, cash, summary } = services(db);
    const groceries = (await new SqliteCategoryRepository(db).findByName(DEFAULT_TENANT_ID, 'Groceries'))!;

    await expenses.create(DEFAULT_TENANT_ID, { txnDate: '2026-06-03', amount: 2500, categoryId: groceries.id });
    await cash.create(DEFAULT_TENANT_ID, { entryDate: '2026-06-04', direction: 'outflow', amount: 1500, categoryId: groceries.id });
    await cash.create(DEFAULT_TENANT_ID, { entryDate: '2026-06-05', direction: 'inflow', amount: 100000 });

    const s = await summary.monthlySummary(DEFAULT_TENANT_ID);
    expect(s.expense).toBe(4000); // 2500 manual + 1500 cash outflow
    expect(s.income).toBe(100000); // cash inflow
    expect(s.net).toBe(96000);
    const groc = s.byCategory.find((c) => c.categoryName === 'Groceries');
    expect(groc?.total).toBe(4000); // manual + cash merged under one category

    const trends = await summary.trends(DEFAULT_TENANT_ID, 6);
    expect(trends.months).toContain('2026-06');
    expect(trends.expenseByMonth[trends.months.indexOf('2026-06')]).toBe(4000);
  });
});
