/**
 * Round-trip tests for the on-device (Local*Repository) implementations.
 *
 * These share the exact same SQL as the Sqlite* implementations (already
 * covered by the backend's test suite); what's actually new here is the
 * async-driver translation, so each test just proves create -> read (and any
 * aggregate queries) survive that translation intact — not a re-test of
 * business logic already covered elsewhere.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runLocalMigrations, type MigrationFile } from '../../db/localMigrate.js';
import { createNodeTestDriver } from '../../db/nodeTestDriver.js';
import type { LocalDbDriver } from '../../db/LocalDbDriver.js';
import { LocalAccountRepository } from './LocalAccountRepository.js';
import { LocalTransactionRepository } from './LocalTransactionRepository.js';
import { LocalCategoryRepository } from './LocalCategoryRepository.js';
import { LocalCategoryRuleRepository } from './LocalCategoryRuleRepository.js';
import { LocalGoalRepository } from './LocalGoalRepository.js';
import { LocalIssueRepository } from './LocalIssueRepository.js';
import { LocalManualExpenseRepository } from './LocalManualExpenseRepository.js';
import { LocalMerchantRuleRepository } from './LocalMerchantRuleRepository.js';
import { LocalSalarySlipRepository } from './LocalSalarySlipRepository.js';
import { LocalSalaryComponentRepository } from './LocalSalaryComponentRepository.js';
import { LocalBankStatementRepository } from './LocalBankStatementRepository.js';
import { LocalAuditRepository } from './LocalAuditRepository.js';
import { LocalUserRepository } from './LocalUserRepository.js';
import { LocalUserSessionRepository } from './LocalUserSessionRepository.js';
import { LocalUserSettingsRepository } from './LocalUserSettingsRepository.js';
import { newId, nowIso } from '../../utils/id.js';
import type { Goal, IssueLog, ManualExpense, MerchantRule, SalarySlip, User, UserSession } from '../../models/index.js';
import type { Transaction } from '../../models/index.js';

const MIGRATIONS_DIR = resolve(process.cwd(), '..', '..', 'db', 'migrations');
const TENANT_ID = '00000000-0000-0000-0000-000000000001';

function loadMigrations(): MigrationFile[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((id) => ({ id, sql: readFileSync(join(MIGRATIONS_DIR, id), 'utf-8') }));
}

async function freshDb(): Promise<LocalDbDriver> {
  const driver = createNodeTestDriver();
  await runLocalMigrations(driver, loadMigrations());
  const now = nowIso();
  await driver.run(
    `INSERT INTO tenant (id, display_name, status, created_at, updated_at) VALUES (?, ?, 'active', ?, ?)`,
    [TENANT_ID, 'Test', now, now],
  );
  return driver;
}

describe('LocalAccountRepository', () => {
  it('creates on first getOrCreate, reuses on second', async () => {
    const db = await freshDb();
    const repo = new LocalAccountRepository(db);
    const a = await repo.getOrCreateBankAccount(TENANT_ID, 'My Bank');
    const b = await repo.getOrCreateBankAccount(TENANT_ID, 'My Bank');
    expect(b.id).toBe(a.id);
    const found = await repo.findById(a.id);
    expect(found?.name).toBe('My Bank');
    expect(found?.kind).toBe('bank');
  });
});

describe('LocalTransactionRepository', () => {
  async function seedAccountAndDoc(db: LocalDbDriver) {
    const accounts = new LocalAccountRepository(db);
    const account = await accounts.getOrCreateBankAccount(TENANT_ID, 'My Bank');
    const now = nowIso();
    const docId = newId();
    await db.run(
      `INSERT INTO document (id, tenant_id, account_id, doc_type, file_path, file_hash, mime_type, byte_size,
         parser_id, parse_status, parse_meta, uploaded_at, archived_at)
       VALUES (?, ?, ?, 'bank_statement', ?, ?, ?, ?, ?, 'ok', ?, ?, ?)`,
      [docId, TENANT_ID, account.id, '/tmp/x.csv', newId(), 'text/csv', 1, null, null, now, null],
    );
    return { accountId: account.id, documentId: docId };
  }

  function txnFixture(accountId: string, documentId: string, amount: number, day: string): Transaction {
    const now = nowIso();
    return {
      id: newId(),
      tenantId: TENANT_ID,
      accountId,
      bankStatementId: null,
      sourceDocumentId: documentId,
      sourceRow: null,
      txnDate: day,
      descriptionRaw: 'WOOLWORTHS SANDTON',
      descriptionNorm: 'woolworths sandton',
      amount,
      direction: 'debit',
      balanceAfter: null,
      currency: 'ZAR',
      categoryId: null,
      categorySource: 'default',
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
  }

  it('creates, finds, and lists a transaction', async () => {
    const db = await freshDb();
    const { accountId, documentId } = await seedAccountAndDoc(db);
    const repo = new LocalTransactionRepository(db);
    const txn = txnFixture(accountId, documentId, 35000, '2026-06-10');
    await repo.create(txn);

    const found = await repo.findById(txn.id);
    expect(found?.amount).toBe(35000);
    expect(found?.flagged).toBe(false);

    const listed = await repo.listByAccount(TENANT_ID, accountId);
    expect(listed).toHaveLength(1);
  });

  it('filter() builds dynamic WHERE clauses correctly', async () => {
    const db = await freshDb();
    const { accountId, documentId } = await seedAccountAndDoc(db);
    const repo = new LocalTransactionRepository(db);
    await repo.create(txnFixture(accountId, documentId, 10000, '2026-06-01'));
    await repo.create(txnFixture(accountId, documentId, 90000, '2026-06-20'));

    const filtered = await repo.filter(TENANT_ID, { amountMin: 50000 });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].amount).toBe(90000);

    const byDate = await repo.filter(TENANT_ID, { dateFrom: '2026-06-15', dateTo: '2026-06-30' });
    expect(byDate).toHaveLength(1);
    expect(byDate[0].txnDate).toBe('2026-06-20');
  });

  it('sumByCategory / monthlyTotals aggregate queries work through the driver', async () => {
    const db = await freshDb();
    const { accountId, documentId } = await seedAccountAndDoc(db);
    const repo = new LocalTransactionRepository(db);
    await repo.create(txnFixture(accountId, documentId, 10000, '2026-06-01'));
    await repo.create(txnFixture(accountId, documentId, 20000, '2026-06-15'));

    const byCategory = await repo.sumByCategory(TENANT_ID, {});
    expect(byCategory[0].total).toBe(30000);
    expect(byCategory[0].count).toBe(2);

    const monthly = await repo.monthlyTotals(TENANT_ID, {});
    expect(monthly).toEqual([{ month: '2026-06', total: 30000 }]);
  });

  it('flagged/category updates persist', async () => {
    const db = await freshDb();
    const { accountId, documentId } = await seedAccountAndDoc(db);
    const repo = new LocalTransactionRepository(db);
    const txn = txnFixture(accountId, documentId, 5000, '2026-06-05');
    await repo.create(txn);

    const catId = newId();
    await repo.updateCategory(txn.id, catId, 'manual', false, 0.9);
    const updated = await repo.findById(txn.id);
    expect(updated?.categoryId).toBe(catId);
    expect(updated?.categorySource).toBe('manual');
    expect(updated?.confidence).toBe(0.9);
  });
});

describe('LocalCategoryRepository + LocalCategoryRuleRepository', () => {
  it('creates a rule, finds it by match, and increments its hit count', async () => {
    const db = await freshDb();
    const categories = new LocalCategoryRepository(db);
    const seeded = await categories.listByTenant(TENANT_ID); // seeded categories come from seedCategories in real app; here we insert one directly
    const now = nowIso();
    const catId = newId();
    await db.run(
      `INSERT INTO category (id, tenant_id, name, parent_id, is_system, color, created_at, updated_at, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [catId, TENANT_ID, 'Groceries', null, 0, null, now, now, null],
    );
    expect(seeded).toHaveLength(0);

    const rules = new LocalCategoryRuleRepository(db);
    const rule = {
      id: newId(),
      tenantId: TENANT_ID,
      matchType: 'contains' as const,
      pattern: 'woolworths',
      categoryId: catId,
      priority: 100,
      learned: false,
      hitCount: 0,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    await rules.create(rule);
    const found = await rules.findMatching(TENANT_ID, 'contains', 'woolworths', catId);
    expect(found?.id).toBe(rule.id);

    await rules.incrementHit(rule.id);
    const list = await rules.listByTenant(TENANT_ID);
    expect(list[0].hitCount).toBe(1);
  });
});

describe('LocalGoalRepository', () => {
  it('creates, updates, lists, and soft-deletes a goal', async () => {
    const db = await freshDb();
    const repo = new LocalGoalRepository(db);
    const now = nowIso();
    const goal: Goal = {
      id: newId(),
      tenantId: TENANT_ID,
      name: 'Emergency fund',
      goalType: 'emergency',
      targetAmount: 5_000_000,
      currentSavings: 0,
      monthlyContribution: 100000,
      targetDate: '2027-01-01',
      categoryId: null,
      icon: null,
      priority: 1,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    await repo.create(goal);
    await repo.update({ ...goal, currentSavings: 200000 });
    const found = await repo.findById(goal.id);
    expect(found?.currentSavings).toBe(200000);

    let list = await repo.listByTenant(TENANT_ID);
    expect(list).toHaveLength(1);

    await repo.softDelete(goal.id);
    list = await repo.listByTenant(TENANT_ID);
    expect(list).toHaveLength(0);
  });
});

describe('LocalIssueRepository', () => {
  it('creates and lists issues by tenant and by entity', async () => {
    const db = await freshDb();
    const repo = new LocalIssueRepository(db);
    const now = nowIso();
    const issue: IssueLog = {
      id: newId(),
      tenantId: TENANT_ID,
      source: 'system',
      kind: 'parse_fail',
      severity: 'error',
      entityType: 'salary_slip',
      entityId: 'slip-1',
      status: 'open',
      detail: { messages: ['bad'] },
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    };
    await repo.create(issue);
    expect(await repo.listByTenant(TENANT_ID)).toHaveLength(1);
    expect(await repo.listByEntity(TENANT_ID, 'salary_slip', 'slip-1')).toHaveLength(1);
    expect(await repo.listByEntity(TENANT_ID, 'salary_slip', 'other')).toHaveLength(0);
  });
});

describe('LocalManualExpenseRepository', () => {
  it('creates, updates, aggregates, and soft-deletes', async () => {
    const db = await freshDb();
    const repo = new LocalManualExpenseRepository(db);
    const now = nowIso();
    const expense: ManualExpense = {
      id: newId(),
      tenantId: TENANT_ID,
      txnDate: '2026-06-10',
      amount: 15000,
      currency: 'ZAR',
      categoryId: null,
      note: 'Lunch',
      reconciledTransactionId: null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    await repo.create(expense);
    await repo.update({ ...expense, amount: 20000 });
    const found = await repo.findById(expense.id);
    expect(found?.amount).toBe(20000);

    const totals = await repo.monthlyTotals(TENANT_ID, {});
    expect(totals).toEqual([{ month: '2026-06', total: 20000 }]);

    await repo.softDelete(expense.id);
    expect(await repo.listByTenant(TENANT_ID)).toHaveLength(0);
  });
});

describe('LocalMerchantRuleRepository', () => {
  it('upserts (insert then update-on-conflict) correctly', async () => {
    const db = await freshDb();
    const repo = new LocalMerchantRuleRepository(db);
    const now = nowIso();
    const rule: MerchantRule = {
      tenantId: TENANT_ID,
      merchant: 'Woolworths',
      category: 'Groceries',
      source: 'system',
      confidence: 1,
      lastUpdated: now,
    };
    await repo.upsert(rule);
    expect(await repo.count(TENANT_ID)).toBe(1);

    await repo.upsert({ ...rule, category: 'Dining', confidence: 0.5 });
    expect(await repo.count(TENANT_ID)).toBe(1); // still one row — updated, not duplicated
    const found = await repo.find(TENANT_ID, 'woolworths');
    expect(found?.category).toBe('Dining');
    expect(found?.confidence).toBe(0.5);
  });
});

describe('LocalSalarySlipRepository + LocalSalaryComponentRepository', () => {
  it('creates a slip with components and lists them in display order', async () => {
    const db = await freshDb();
    const accounts = new LocalAccountRepository(db);
    const account = await accounts.getOrCreateIncomeSource(TENANT_ID, 'ACME');
    const now = nowIso();
    const docId = newId();
    await db.run(
      `INSERT INTO document (id, tenant_id, account_id, doc_type, file_path, file_hash, mime_type, byte_size,
         parser_id, parse_status, parse_meta, uploaded_at, archived_at)
       VALUES (?, ?, ?, 'payslip', ?, ?, ?, ?, ?, 'ok', ?, ?, ?)`,
      [docId, TENANT_ID, account.id, '/tmp/slip.pdf', newId(), 'application/pdf', 1, null, null, now, null],
    );
    const slips = new LocalSalarySlipRepository(db);
    const slip: SalarySlip = {
      id: newId(),
      tenantId: TENANT_ID,
      accountId: account.id,
      sourceDocumentId: docId,
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      payDate: '2026-06-25',
      grossAmount: 5000000,
      netAmount: 4000000,
      currency: 'ZAR',
      employerName: 'ACME',
      employeeName: 'Jane',
      periodLabel: 'June 2026',
      notes: null,
      confirmed: false,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    await slips.create(slip);

    const components = new LocalSalaryComponentRepository(db);
    await components.createMany([
      { id: newId(), tenantId: TENANT_ID, salarySlipId: slip.id, componentType: 'earning', section: null, code: null, label: 'Basic', amount: 4500000, isTaxable: true, confidence: 1, displayOrder: 1, createdAt: now, updatedAt: now },
      { id: newId(), tenantId: TENANT_ID, salarySlipId: slip.id, componentType: 'deduction', section: null, code: null, label: 'PAYE', amount: 900000, isTaxable: null, confidence: 1, displayOrder: 0, createdAt: now, updatedAt: now },
    ]);

    const list = await components.listBySlip(slip.id);
    expect(list).toHaveLength(2);
    expect(list[0].label).toBe('PAYE'); // displayOrder 0 first
    expect(await slips.listByTenant(TENANT_ID)).toHaveLength(1);
  });
});

describe('LocalBankStatementRepository', () => {
  it('creates and lists statements', async () => {
    const db = await freshDb();
    const accounts = new LocalAccountRepository(db);
    const account = await accounts.getOrCreateBankAccount(TENANT_ID, 'My Bank');
    const now = nowIso();
    const docId = newId();
    await db.run(
      `INSERT INTO document (id, tenant_id, account_id, doc_type, file_path, file_hash, mime_type, byte_size,
         parser_id, parse_status, parse_meta, uploaded_at, archived_at)
       VALUES (?, ?, ?, 'bank_statement', ?, ?, ?, ?, ?, 'ok', ?, ?, ?)`,
      [docId, TENANT_ID, account.id, '/tmp/x.csv', newId(), 'text/csv', 1, null, null, now, null],
    );
    const repo = new LocalBankStatementRepository(db);
    await repo.create({
      id: newId(), tenantId: TENANT_ID, accountId: account.id, sourceDocumentId: docId,
      periodStart: '2026-06-01', periodEnd: '2026-06-30', openingBalance: 100000, closingBalance: 90000,
      currency: 'ZAR', createdAt: now, updatedAt: now, archivedAt: null,
    });
    expect(await repo.listByTenant(TENANT_ID)).toHaveLength(1);
  });
});

describe('LocalAuditRepository', () => {
  it('appends and lists, filtered and unfiltered', async () => {
    const db = await freshDb();
    const repo = new LocalAuditRepository(db);
    await repo.append({
      id: newId(), tenantId: TENANT_ID, actor: 'user:1', actorRole: null, action: 'test.action',
      entityType: 'test', entityId: null, before: null, after: null, context: { foo: 'bar' }, at: nowIso(),
    });
    expect(await repo.list(TENANT_ID)).toHaveLength(1);
    expect(await repo.list()).toHaveLength(1);
    expect(await repo.list('other-tenant')).toHaveLength(0);
  });
});

describe('LocalUserRepository (preserved for V2 — not used by V1 runtime)', () => {
  it('creates a user with roles, links role_id correctly, and manages login state', async () => {
    const db = await freshDb();
    await db.run(`INSERT INTO role (id, name) VALUES ('role-user-1', 'user')`);
    const repo = new LocalUserRepository(db);
    const now = nowIso();
    const user: User = {
      id: newId(), tenantId: TENANT_ID, email: 'test@example.com', emailVerifiedAt: null,
      passwordHash: 'hash', passwordAlgo: 'bcrypt', status: 'active', failedLoginCount: 0,
      lockedUntil: null, mfaEnabled: false, lastLoginAt: null, createdAt: now, updatedAt: now, archivedAt: null,
    };
    await repo.create(user, ['user']);
    const roles = await repo.getRoles(user.id);
    expect(roles).toEqual(['user']);

    await repo.incrementFailedLogin(user.id);
    let found = await repo.findByEmail(TENANT_ID, 'test@example.com');
    expect(found?.failedLoginCount).toBe(1);

    await repo.recordLogin(user.id);
    found = await repo.findById(user.id);
    expect(found?.failedLoginCount).toBe(0);
    expect(found?.lastLoginAt).not.toBeNull();
  });
});

describe('LocalUserSessionRepository (preserved for V2)', () => {
  it('creates, finds by refresh hash, touches, and revokes', async () => {
    const db = await freshDb();
    await db.run(`INSERT INTO role (id, name) VALUES ('role-user-1', 'user')`);
    const users = new LocalUserRepository(db);
    const now = nowIso();
    const user: User = {
      id: newId(), tenantId: TENANT_ID, email: 'sess@example.com', emailVerifiedAt: null,
      passwordHash: 'hash', passwordAlgo: 'bcrypt', status: 'active', failedLoginCount: 0,
      lockedUntil: null, mfaEnabled: false, lastLoginAt: null, createdAt: now, updatedAt: now, archivedAt: null,
    };
    await users.create(user, ['user']);

    const repo = new LocalUserSessionRepository(db);
    const session: UserSession = {
      id: newId(), tenantId: TENANT_ID, userId: user.id, refreshTokenHash: 'hash-abc',
      userAgent: null, ip: null, createdAt: now, lastUsedAt: now,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(), revokedAt: null,
    };
    await repo.create(session);
    expect((await repo.findByRefreshHash('hash-abc'))?.id).toBe(session.id);
    expect(await repo.listActiveByUser(user.id)).toHaveLength(1);

    await repo.revoke(session.id);
    expect(await repo.listActiveByUser(user.id)).toHaveLength(0);
  });
});

describe('LocalUserSettingsRepository', () => {
  it('upserts settings (insert then update-on-conflict)', async () => {
    const db = await freshDb();
    await db.run(`INSERT INTO role (id, name) VALUES ('role-user-1', 'user')`);
    const users = new LocalUserRepository(db);
    const now = nowIso();
    const user: User = {
      id: newId(), tenantId: TENANT_ID, email: 'settings@example.com', emailVerifiedAt: null,
      passwordHash: 'hash', passwordAlgo: 'bcrypt', status: 'active', failedLoginCount: 0,
      lockedUntil: null, mfaEnabled: false, lastLoginAt: null, createdAt: now, updatedAt: now, archivedAt: null,
    };
    await users.create(user, ['user']);

    const repo = new LocalUserSettingsRepository(db);
    await repo.save({
      userId: user.id, tenantId: TENANT_ID, displayName: 'Test', theme: 'dark',
      currency: 'ZAR', chartType: 'bar', defaultMonth: 'current', layout: 'auto', createdAt: now, updatedAt: now,
    });
    await repo.save({
      userId: user.id, tenantId: TENANT_ID, displayName: 'Test Updated', theme: 'light',
      currency: 'ZAR', chartType: 'bar', defaultMonth: 'current', layout: 'auto', createdAt: now, updatedAt: now,
    });
    const found = await repo.findByUser(user.id);
    expect(found?.displayName).toBe('Test Updated');
    expect(found?.theme).toBe('light');
  });
});
