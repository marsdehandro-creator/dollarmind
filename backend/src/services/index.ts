/**
 * Service composition root.
 *
 * Wires SQLite-backed repositories to services and exports singletons for
 * controllers/middleware. This is the one place that knows about concrete
 * implementations (docs/architecture.md §2).
 */
import { getDb } from '../db/index.js';
import { SqliteUserRepository } from '../repositories/sqlite/SqliteUserRepository.js';
import { SqliteAuditRepository } from '../repositories/sqlite/SqliteAuditRepository.js';
import { SqliteAccountRepository } from '../repositories/sqlite/SqliteAccountRepository.js';
import { SqliteDocumentRepository } from '../repositories/sqlite/SqliteDocumentRepository.js';
import { SqliteSalarySlipRepository } from '../repositories/sqlite/SqliteSalarySlipRepository.js';
import { SqliteSalaryComponentRepository } from '../repositories/sqlite/SqliteSalaryComponentRepository.js';
import { SqliteIssueRepository } from '../repositories/sqlite/SqliteIssueRepository.js';
import { SqliteBankStatementRepository } from '../repositories/sqlite/SqliteBankStatementRepository.js';
import { SqliteTransactionRepository } from '../repositories/sqlite/SqliteTransactionRepository.js';
import { SqliteCategoryRepository } from '../repositories/sqlite/SqliteCategoryRepository.js';
import { SqliteCategoryRuleRepository } from '../repositories/sqlite/SqliteCategoryRuleRepository.js';
import { SqliteMerchantRuleRepository } from '../repositories/sqlite/SqliteMerchantRuleRepository.js';
import { SqliteManualExpenseRepository } from '../repositories/sqlite/SqliteManualExpenseRepository.js';
import { SqliteCashEntryRepository } from '../repositories/sqlite/SqliteCashEntryRepository.js';
import { SqliteUserSettingsRepository } from '../repositories/sqlite/SqliteUserSettingsRepository.js';
import { SqliteUserSessionRepository } from '../repositories/sqlite/SqliteUserSessionRepository.js';
import { SqliteGoalRepository } from '../repositories/sqlite/SqliteGoalRepository.js';
import { LocalAuditService } from '@dollarmind/core/services/LocalAuditService.js';
import { LocalAuthService } from '@dollarmind/core/services/LocalAuthService.js';
import { LocalSalarySlipService } from '@dollarmind/core/services/LocalSalarySlipService.js';
import { LocalDeduplicationService } from '@dollarmind/core/services/LocalDeduplicationService.js';
import { LocalStatementImportService } from '@dollarmind/core/services/LocalStatementImportService.js';
import { LocalTransactionService } from '@dollarmind/core/services/LocalTransactionService.js';
import { LocalCategorizationService } from '@dollarmind/core/services/LocalCategorizationService.js';
import { MerchantDetectionService, type MerchantRulesConfig } from '@dollarmind/core/services/MerchantDetectionService.js';
import { MerchantCategorizationService } from '@dollarmind/core/services/MerchantCategorizationService.js';
import { AdaptiveLearningService } from '@dollarmind/core/services/AdaptiveLearningService.js';
import { LocalTransactionCategorizationService } from '@dollarmind/core/services/LocalTransactionCategorizationService.js';
import { LocalSpendingSummaryService } from '@dollarmind/core/services/LocalSpendingSummaryService.js';
import { LocalManualExpenseService } from '@dollarmind/core/services/LocalManualExpenseService.js';
import { LocalCashEntryService } from '@dollarmind/core/services/LocalCashEntryService.js';
import { LocalUserSettingsService } from '@dollarmind/core/services/LocalUserSettingsService.js';
import { LocalSecurityService } from '@dollarmind/core/services/LocalSecurityService.js';
import { LocalGoalService } from '@dollarmind/core/services/LocalGoalService.js';
import { LocalDashboardService } from '@dollarmind/core/services/LocalDashboardService.js';
import { LocalDashboardAggregationService } from '@dollarmind/core/services/LocalDashboardAggregationService.js';
import { NodeFileStore } from './NodeFileStore.js';
import { extractPdf } from '@dollarmind/core/ingestion/pdf.js';
import { getOcrProvider } from '@dollarmind/core/ingestion/ocr.js';
import type { ExtractionAdapters } from '@dollarmind/core/ingestion/extract.js';
import { env, loadMerchantRules, loadSalaryParserRules, loadStatementParserRules } from '../config/index.js';
import type { SalaryParserRules } from '@dollarmind/core/parsers/payslip/payslipParser.js';
import type { StatementParserRules } from '@dollarmind/core/parsers/bank/statementParser.js';

const db = getDb();
const extractionAdapters: ExtractionAdapters = { ocr: getOcrProvider(), extractPdf };

// Repositories (concrete, SQLite-backed).
export const userRepository = new SqliteUserRepository(db);
export const auditRepository = new SqliteAuditRepository(db);
export const accountRepository = new SqliteAccountRepository(db);
export const documentRepository = new SqliteDocumentRepository(db);
export const salarySlipRepository = new SqliteSalarySlipRepository(db);
export const salaryComponentRepository = new SqliteSalaryComponentRepository(db);
export const issueRepository = new SqliteIssueRepository(db);
export const bankStatementRepository = new SqliteBankStatementRepository(db);
export const transactionRepository = new SqliteTransactionRepository(db);
export const categoryRepository = new SqliteCategoryRepository(db);
export const categoryRuleRepository = new SqliteCategoryRuleRepository(db);
export const merchantRuleRepository = new SqliteMerchantRuleRepository(db);
export const manualExpenseRepository = new SqliteManualExpenseRepository(db);
export const cashEntryRepository = new SqliteCashEntryRepository(db);
export const userSettingsRepository = new SqliteUserSettingsRepository(db);
export const userSessionRepository = new SqliteUserSessionRepository(db);
export const goalRepository = new SqliteGoalRepository(db);

// Services.
export const auditService = new LocalAuditService(auditRepository);
export const authService = new LocalAuthService(userRepository, auditService, env.JWT_SECRET, env.JWT_EXPIRES_IN);
export const salarySlipService = new LocalSalarySlipService(
  {
    accounts: accountRepository,
    documents: documentRepository,
    slips: salarySlipRepository,
    components: salaryComponentRepository,
    issues: issueRepository,
    audit: auditService,
  },
  loadSalaryParserRules<SalaryParserRules>(),
  new NodeFileStore('salary-slips'),
  extractionAdapters,
);

const merchantRulesConfig = loadMerchantRules<MerchantRulesConfig>();

export const deduplicationService = new LocalDeduplicationService();
export const categorizationService = new LocalCategorizationService(categoryRuleRepository, merchantRulesConfig);
export const merchantDetectionService = new MerchantDetectionService(merchantRulesConfig);
export const merchantCategorizationService = new MerchantCategorizationService(
  merchantRuleRepository,
  categoryRepository,
  categoryRuleRepository,
  merchantDetectionService,
  categorizationService,
);
export const adaptiveLearningService = new AdaptiveLearningService(
  merchantRuleRepository,
  merchantDetectionService,
  merchantCategorizationService,
);
export const statementImportService = new LocalStatementImportService(
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
  loadStatementParserRules<StatementParserRules>(),
  new NodeFileStore('statements'),
  extractionAdapters,
);
export const transactionService = new LocalTransactionService(transactionRepository);

export const transactionCategorizationService = new LocalTransactionCategorizationService(
  transactionRepository,
  categoryRuleRepository,
  categorizationService,
  auditService,
  categoryRepository,
  adaptiveLearningService,
);
export const manualExpenseService = new LocalManualExpenseService(manualExpenseRepository, auditService);
export const cashEntryService = new LocalCashEntryService(cashEntryRepository, auditService);
export const spendingSummaryService = new LocalSpendingSummaryService(
  transactionRepository,
  categoryRepository,
  manualExpenseRepository,
  cashEntryRepository,
);

export type { AuthService } from '@dollarmind/core/services/interfaces/AuthService.js';
export type { AuditService } from '@dollarmind/core/services/interfaces/AuditService.js';
export type { SalarySlipService } from '@dollarmind/core/services/interfaces/SalarySlipService.js';
export const securityService = new LocalSecurityService(
  userSessionRepository,
  userRepository,
  auditService,
  env.JWT_SECRET,
  env.JWT_EXPIRES_IN,
);
export const userSettingsService = new LocalUserSettingsService(
  userSettingsRepository,
  userRepository,
  userSessionRepository,
  auditService,
);

export const goalService = new LocalGoalService(goalRepository, categoryRepository, auditService);
export const dashboardService = new LocalDashboardService(
  spendingSummaryService,
  transactionRepository,
  manualExpenseRepository,
  cashEntryRepository,
  issueRepository,
  salarySlipRepository,
);
export const dashboardAggregationService = new LocalDashboardAggregationService(
  spendingSummaryService,
  dashboardService,
  salarySlipRepository,
  transactionRepository,
  manualExpenseRepository,
  cashEntryRepository,
);

export type { StatementImportService } from '@dollarmind/core/services/interfaces/StatementImportService.js';
export type { TransactionService } from '@dollarmind/core/services/interfaces/TransactionService.js';
export type { UserSettingsService } from '@dollarmind/core/services/interfaces/UserSettingsService.js';
export type { SecurityService } from '@dollarmind/core/services/interfaces/SecurityService.js';
export type { GoalService } from '@dollarmind/core/services/interfaces/GoalService.js';
export type { DashboardService } from '@dollarmind/core/services/interfaces/DashboardService.js';
