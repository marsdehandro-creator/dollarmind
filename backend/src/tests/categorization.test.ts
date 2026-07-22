/**
 * Category detection + adaptive learning tests (in-memory SQLite, seeded rules).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createConfiguredDb, type Db } from '../db/index.js';
import { SqliteTransactionRepository } from '../repositories/sqlite/SqliteTransactionRepository.js';
import { SqliteCategoryRepository } from '../repositories/sqlite/SqliteCategoryRepository.js';
import { SqliteCategoryRuleRepository } from '../repositories/sqlite/SqliteCategoryRuleRepository.js';
import { SqliteAuditRepository } from '../repositories/sqlite/SqliteAuditRepository.js';
import { SqliteAccountRepository } from '../repositories/sqlite/SqliteAccountRepository.js';
import { SqliteDocumentRepository } from '../repositories/sqlite/SqliteDocumentRepository.js';
import { SqliteMerchantRuleRepository } from '../repositories/sqlite/SqliteMerchantRuleRepository.js';
import { LocalAuditService } from '@dollarmind/core/services/LocalAuditService.js';
import { LocalCategorizationService } from '@dollarmind/core/services/LocalCategorizationService.js';
import { MerchantDetectionService } from '@dollarmind/core/services/MerchantDetectionService.js';
import { MerchantCategorizationService } from '@dollarmind/core/services/MerchantCategorizationService.js';
import { AdaptiveLearningService } from '@dollarmind/core/services/AdaptiveLearningService.js';
import { LocalTransactionCategorizationService } from '@dollarmind/core/services/LocalTransactionCategorizationService.js';
import { DEFAULT_TENANT_ID, loadMerchantRules } from '../config/index.js';
import type { Document, Transaction } from '@dollarmind/core/models/index.js';
import type { MerchantRulesConfig } from '@dollarmind/core/services/MerchantDetectionService.js';
import { newId, nowIso } from '@dollarmind/core/utils/id.js';

const merchantRulesConfig = loadMerchantRules<MerchantRulesConfig>();

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

function makeTxn(db: Db, desc: string, amount = 10000): Transaction {
  const now = nowIso();
  const txn: Transaction = {
    id: newId(),
    tenantId: DEFAULT_TENANT_ID,
    accountId,
    bankStatementId: null,
    sourceDocumentId: documentId,
    sourceRow: null,
    txnDate: '2026-06-15',
    descriptionRaw: desc,
    descriptionNorm: desc.toLowerCase(),
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
  new SqliteTransactionRepository(db).create(txn);
  return txn;
}

function makeServices(db: Db) {
  const txns = new SqliteTransactionRepository(db);
  const cats = new SqliteCategoryRepository(db);
  const rules = new SqliteCategoryRuleRepository(db);
  const categorizer = new LocalCategorizationService(rules, merchantRulesConfig);
  const merchantRules = new SqliteMerchantRuleRepository(db);
  const detection = new MerchantDetectionService(merchantRulesConfig);
  const merchantCat = new MerchantCategorizationService(merchantRules, cats, rules, detection, categorizer);
  const adaptive = new AdaptiveLearningService(merchantRules, detection, merchantCat);
  const orchestrator = new LocalTransactionCategorizationService(
    txns,
    rules,
    categorizer,
    new LocalAuditService(new SqliteAuditRepository(db)),
    cats,
    adaptive,
  );
  return { txns, cats, rules, categorizer, merchantCat, orchestrator };
}

describe('category detection', () => {
  let db: Db;
  beforeEach(async () => {
    db = createConfiguredDb(':memory:');
    await setupFixtures(db);
  });

  it('auto-categorizes by seeded merchant rule (Woolworths -> Groceries)', async () => {
    makeTxn(db, 'WOOLWORTHS SANDTON');
    const { orchestrator, txns, cats } = makeServices(db);
    const result = await orchestrator.categorizeUncategorized(DEFAULT_TENANT_ID);
    expect(result.categorized).toBe(1);

    const all = await txns.listByTenant(DEFAULT_TENANT_ID);
    const groceries = (await cats.findByName(DEFAULT_TENANT_ID, 'Groceries'))!;
    expect(all[0].categoryId).toBe(groceries.id);
    expect(all[0].categorySource).toBe('rule');
  });

  it('leaves an unknown merchant uncategorized', async () => {
    makeTxn(db, 'MYSTERY VENDOR XYZ');
    const { orchestrator, txns } = makeServices(db);
    await orchestrator.categorizeUncategorized(DEFAULT_TENANT_ID);
    const all = await txns.listByTenant(DEFAULT_TENANT_ID);
    expect(all[0].categoryId).toBeNull();
  });
});

describe('adaptive learning', () => {
  let db: Db;
  beforeEach(async () => {
    db = createConfiguredDb(':memory:');
    await setupFixtures(db);
  });

  it('creates a learned rule on manual override that categorizes future matches', async () => {
    const { orchestrator, cats, rules } = makeServices(db);
    const dining = (await cats.findByName(DEFAULT_TENANT_ID, 'Dining'))!;

    const first = makeTxn(db, 'JOES COFFEE SHOP');
    const before = (await rules.listByTenant(DEFAULT_TENANT_ID)).length;
    const override = await orchestrator.overrideCategory(DEFAULT_TENANT_ID, first.id, dining.id);
    expect(override.learnedRule).not.toBeNull();
    expect((await rules.listByTenant(DEFAULT_TENANT_ID)).length).toBe(before + 1);

    // A NEW transaction with the same merchant token is now auto-categorized.
    makeTxn(db, 'JOES COFFEE SANDTON');
    const result = await orchestrator.categorizeUncategorized(DEFAULT_TENANT_ID);
    expect(result.categorized).toBeGreaterThanOrEqual(1);
    const txns = new SqliteTransactionRepository(db);
    const joes = (await txns.listByTenant(DEFAULT_TENANT_ID)).find((t) => t.descriptionRaw === 'JOES COFFEE SANDTON')!;
    expect(joes.categoryId).toBe(dining.id);
  });
});
