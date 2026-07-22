/**
 * On-device service composition root — the frontend's equivalent of
 * backend/src/services/index.ts. Wires the same Local*Service classes to
 * Local*Repository implementations (instead of Sqlite*), against the
 * on-device driver. Every exported instance has the exact same shape as its
 * backend counterpart (docs/v2-migration-spec.md's core principle), so
 * frontend/src/services/*.ts can call these directly in place of HTTP.
 */
import { getLocalDb } from './db.js';
import { loadMerchantRules, loadSalaryParserRules, loadStatementParserRules } from './config.js';
import { BlobFileStore } from './BlobFileStore.js';
import { extractionAdapters } from './extraction.js';

import { LocalAccountRepository } from '@dollarmind/core/repositories/local/LocalAccountRepository.js';
import { LocalAuditRepository } from '@dollarmind/core/repositories/local/LocalAuditRepository.js';
import { LocalDocumentRepository } from '@dollarmind/core/repositories/local/LocalDocumentRepository.js';
import { LocalSalarySlipRepository } from '@dollarmind/core/repositories/local/LocalSalarySlipRepository.js';
import { LocalSalaryComponentRepository } from '@dollarmind/core/repositories/local/LocalSalaryComponentRepository.js';
import { LocalIssueRepository } from '@dollarmind/core/repositories/local/LocalIssueRepository.js';
import { LocalBankStatementRepository } from '@dollarmind/core/repositories/local/LocalBankStatementRepository.js';
import { LocalTransactionRepository } from '@dollarmind/core/repositories/local/LocalTransactionRepository.js';
import { LocalCategoryRepository } from '@dollarmind/core/repositories/local/LocalCategoryRepository.js';
import { LocalCategoryRuleRepository } from '@dollarmind/core/repositories/local/LocalCategoryRuleRepository.js';
import { LocalMerchantRuleRepository } from '@dollarmind/core/repositories/local/LocalMerchantRuleRepository.js';
import { LocalManualExpenseRepository } from '@dollarmind/core/repositories/local/LocalManualExpenseRepository.js';
import { LocalCashEntryRepository } from '@dollarmind/core/repositories/local/LocalCashEntryRepository.js';
import { LocalGoalRepository } from '@dollarmind/core/repositories/local/LocalGoalRepository.js';

import { LocalAuditService } from '@dollarmind/core/services/LocalAuditService.js';
import { LocalSalarySlipService } from '@dollarmind/core/services/LocalSalarySlipService.js';
import { LocalDeduplicationService } from '@dollarmind/core/services/LocalDeduplicationService.js';
import { LocalStatementImportService } from '@dollarmind/core/services/LocalStatementImportService.js';
import { LocalTransactionService } from '@dollarmind/core/services/LocalTransactionService.js';
import { LocalCategorizationService } from '@dollarmind/core/services/LocalCategorizationService.js';
import { MerchantDetectionService } from '@dollarmind/core/services/MerchantDetectionService.js';
import { MerchantCategorizationService } from '@dollarmind/core/services/MerchantCategorizationService.js';
import { AdaptiveLearningService } from '@dollarmind/core/services/AdaptiveLearningService.js';
import { LocalTransactionCategorizationService } from '@dollarmind/core/services/LocalTransactionCategorizationService.js';
import { LocalSpendingSummaryService } from '@dollarmind/core/services/LocalSpendingSummaryService.js';
import { LocalManualExpenseService } from '@dollarmind/core/services/LocalManualExpenseService.js';
import { LocalCashEntryService } from '@dollarmind/core/services/LocalCashEntryService.js';
import { LocalGoalService } from '@dollarmind/core/services/LocalGoalService.js';
import { LocalDashboardService } from '@dollarmind/core/services/LocalDashboardService.js';
import { LocalDashboardAggregationService } from '@dollarmind/core/services/LocalDashboardAggregationService.js';

import { DEFAULT_TENANT_ID } from '@dollarmind/core/constants.js';

export interface LocalContainer {
  tenantId: string;
  accountRepository: LocalAccountRepository;
  documentRepository: LocalDocumentRepository;
  issueRepository: LocalIssueRepository;
  transactionRepository: LocalTransactionRepository;
  categoryRepository: LocalCategoryRepository;
  categoryRuleRepository: LocalCategoryRuleRepository;
  merchantRuleRepository: LocalMerchantRuleRepository;
  manualExpenseRepository: LocalManualExpenseRepository;
  cashEntryRepository: LocalCashEntryRepository;
  goalRepository: LocalGoalRepository;
  bankStatementRepository: LocalBankStatementRepository;
  salarySlipRepository: LocalSalarySlipRepository;

  auditService: LocalAuditService;
  salarySlipService: LocalSalarySlipService;
  statementImportService: LocalStatementImportService;
  transactionService: LocalTransactionService;
  transactionCategorizationService: LocalTransactionCategorizationService;
  manualExpenseService: LocalManualExpenseService;
  cashEntryService: LocalCashEntryService;
  spendingSummaryService: LocalSpendingSummaryService;
  goalService: LocalGoalService;
  dashboardService: LocalDashboardService;
  dashboardAggregationService: LocalDashboardAggregationService;
  merchantCategorizationService: MerchantCategorizationService;
}

let containerPromise: Promise<LocalContainer> | null = null;

async function build(): Promise<LocalContainer> {
  const db = await getLocalDb();

  const accountRepository = new LocalAccountRepository(db);
  const auditRepository = new LocalAuditRepository(db);
  const documentRepository = new LocalDocumentRepository(db);
  const salarySlipRepository = new LocalSalarySlipRepository(db);
  const salaryComponentRepository = new LocalSalaryComponentRepository(db);
  const issueRepository = new LocalIssueRepository(db);
  const bankStatementRepository = new LocalBankStatementRepository(db);
  const transactionRepository = new LocalTransactionRepository(db);
  const categoryRepository = new LocalCategoryRepository(db);
  const categoryRuleRepository = new LocalCategoryRuleRepository(db);
  const merchantRuleRepository = new LocalMerchantRuleRepository(db);
  const manualExpenseRepository = new LocalManualExpenseRepository(db);
  const cashEntryRepository = new LocalCashEntryRepository(db);
  const goalRepository = new LocalGoalRepository(db);

  const auditService = new LocalAuditService(auditRepository);
  const salarySlipService = new LocalSalarySlipService(
    {
      accounts: accountRepository,
      documents: documentRepository,
      slips: salarySlipRepository,
      components: salaryComponentRepository,
      issues: issueRepository,
      audit: auditService,
    },
    loadSalaryParserRules(),
    new BlobFileStore('salary-slips'),
    extractionAdapters,
  );

  const merchantRulesConfig = loadMerchantRules();
  const deduplicationService = new LocalDeduplicationService();
  const categorizationService = new LocalCategorizationService(categoryRuleRepository, merchantRulesConfig);
  const merchantDetectionService = new MerchantDetectionService(merchantRulesConfig);
  const merchantCategorizationService = new MerchantCategorizationService(
    merchantRuleRepository,
    categoryRepository,
    categoryRuleRepository,
    merchantDetectionService,
    categorizationService,
  );
  const adaptiveLearningService = new AdaptiveLearningService(
    merchantRuleRepository,
    merchantDetectionService,
    merchantCategorizationService,
  );
  const statementImportService = new LocalStatementImportService(
    {
      accounts: accountRepository,
      documents: documentRepository,
      statements: bankStatementRepository,
      transactions: transactionRepository,
      issues: issueRepository,
      merchantCategorizer: merchantCategorizationService,
      dedup: deduplicationService,
      audit: auditService,
    },
    loadStatementParserRules(),
    new BlobFileStore('statements'),
    extractionAdapters,
  );
  const transactionService = new LocalTransactionService(transactionRepository);
  const transactionCategorizationService = new LocalTransactionCategorizationService(
    transactionRepository,
    categoryRuleRepository,
    categorizationService,
    auditService,
    categoryRepository,
    adaptiveLearningService,
  );
  const manualExpenseService = new LocalManualExpenseService(manualExpenseRepository, auditService);
  const cashEntryService = new LocalCashEntryService(cashEntryRepository, auditService);
  const spendingSummaryService = new LocalSpendingSummaryService(
    transactionRepository,
    categoryRepository,
    manualExpenseRepository,
    cashEntryRepository,
  );
  const goalService = new LocalGoalService(goalRepository, categoryRepository, auditService);
  const dashboardService = new LocalDashboardService(
    spendingSummaryService,
    transactionRepository,
    manualExpenseRepository,
    cashEntryRepository,
    issueRepository,
    salarySlipRepository,
  );
  const dashboardAggregationService = new LocalDashboardAggregationService(
    spendingSummaryService,
    dashboardService,
    salarySlipRepository,
    transactionRepository,
    manualExpenseRepository,
    cashEntryRepository,
  );

  return {
    tenantId: DEFAULT_TENANT_ID,
    accountRepository,
    documentRepository,
    issueRepository,
    transactionRepository,
    categoryRepository,
    categoryRuleRepository,
    merchantRuleRepository,
    manualExpenseRepository,
    cashEntryRepository,
    goalRepository,
    bankStatementRepository,
    salarySlipRepository,
    auditService,
    salarySlipService,
    statementImportService,
    transactionService,
    transactionCategorizationService,
    manualExpenseService,
    cashEntryService,
    spendingSummaryService,
    goalService,
    dashboardService,
    dashboardAggregationService,
    merchantCategorizationService,
  };
}

/** Process-wide singleton composition root — built once, reused everywhere. */
export function getContainer(): Promise<LocalContainer> {
  if (!containerPromise) containerPromise = build();
  return containerPromise;
}
