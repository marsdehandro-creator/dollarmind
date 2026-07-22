/**
 * Repository ports (interfaces). Concrete instances are wired in
 * src/services/index.ts (the composition root).
 */
export type { UserRepository } from './UserRepository.js';
export type { AuditRepository } from './AuditRepository.js';
export type { AccountRepository } from './AccountRepository.js';
export type { DocumentRepository } from './DocumentRepository.js';
export type { SalarySlipRepository } from './SalarySlipRepository.js';
export type { SalaryComponentRepository } from './SalaryComponentRepository.js';
export type { IssueRepository } from './IssueRepository.js';
export type { BankStatementRepository } from './BankStatementRepository.js';
export type {
  TransactionRepository,
  TransactionFilterCriteria,
} from './TransactionRepository.js';
export type { CategoryRepository } from './CategoryRepository.js';
export type { CategoryRuleRepository } from './CategoryRuleRepository.js';
export type { MerchantRuleRepository } from './MerchantRuleRepository.js';
export type { ManualExpenseRepository, DateRange } from './ManualExpenseRepository.js';
export type { CashEntryRepository, CashAggregateOptions } from './CashEntryRepository.js';
export type { UserSettingsRepository } from './UserSettingsRepository.js';
export type { UserSessionRepository } from './UserSessionRepository.js';
export type { GoalRepository } from './GoalRepository.js';
