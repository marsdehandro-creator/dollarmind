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
import { LocalAuditService } from './LocalAuditService.js';
import { LocalAuthService } from './LocalAuthService.js';
import { LocalSalarySlipService } from './LocalSalarySlipService.js';
import { LocalDeduplicationService } from './LocalDeduplicationService.js';
import { LocalStatementImportService } from './LocalStatementImportService.js';
import { LocalTransactionService } from './LocalTransactionService.js';
import { LocalCategorizationService } from './LocalCategorizationService.js';
import { MerchantDetectionService } from './MerchantDetectionService.js';
import { MerchantCategorizationService } from './MerchantCategorizationService.js';
import { AdaptiveLearningService } from './AdaptiveLearningService.js';
import { LocalTransactionCategorizationService } from './LocalTransactionCategorizationService.js';
import { LocalSpendingSummaryService } from './LocalSpendingSummaryService.js';
import { LocalManualExpenseService } from './LocalManualExpenseService.js';
import { LocalCashEntryService } from './LocalCashEntryService.js';
import { LocalUserSettingsService } from './LocalUserSettingsService.js';
import { LocalSecurityService } from './LocalSecurityService.js';
import { LocalGoalService } from './LocalGoalService.js';
import { LocalDashboardService } from './LocalDashboardService.js';
import { LocalDashboardAggregationService } from './LocalDashboardAggregationService.js';

const db = getDb();

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
export const authService = new LocalAuthService(userRepository, auditService);
export const salarySlipService = new LocalSalarySlipService({
  accounts: accountRepository,
  documents: documentRepository,
  slips: salarySlipRepository,
  components: salaryComponentRepository,
  issues: issueRepository,
  audit: auditService,
});

export const deduplicationService = new LocalDeduplicationService();
export const categorizationService = new LocalCategorizationService(categoryRuleRepository);
export const merchantDetectionService = new MerchantDetectionService();
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
export const statementImportService = new LocalStatementImportService({
  accounts: accountRepository,
  documents: documentRepository,
  statements: bankStatementRepository,
  transactions: transactionRepository,
  issues: issueRepository,
  merchantCategorizer: merchantCategorizationService,
  dedup: deduplicationService,
  audit: auditService,
});
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

export type { AuthService } from './interfaces/AuthService.js';
export type { AuditService } from './interfaces/AuditService.js';
export type { SalarySlipService } from './interfaces/SalarySlipService.js';
export const securityService = new LocalSecurityService(userSessionRepository, userRepository, auditService);
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

export type { StatementImportService } from './interfaces/StatementImportService.js';
export type { TransactionService } from './interfaces/TransactionService.js';
export type { UserSettingsService } from './interfaces/UserSettingsService.js';
export type { SecurityService } from './interfaces/SecurityService.js';
export type { GoalService } from './interfaces/GoalService.js';
export type { DashboardService } from './interfaces/DashboardService.js';
