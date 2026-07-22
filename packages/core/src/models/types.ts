/**
 * Domain model types (pilot).
 *
 * Mirrors the canonical data model in docs/data-model.md. These are plain
 * TypeScript shapes — the persistence layer (repositories) arrives in Phase 6.
 *
 * Conventions (see docs/data-model.md §1):
 *  - `id` and all foreign keys are UUID strings.
 *  - Money is integer minor units (cents), e.g. 1234 = R12.34.
 *  - Timestamps are ISO-8601 UTC strings.
 *  - `archivedAt` is soft-delete; null/undefined means active.
 */

export type UUID = string;
export type ISOTimestamp = string;
export type ISODate = string;
/** Integer minor units (cents). */
export type Cents = number;

export interface Tenant {
  id: UUID;
  displayName: string;
  status: 'active' | 'suspended';
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

export interface User {
  id: UUID;
  tenantId: UUID;
  email: string;
  emailVerifiedAt: ISOTimestamp | null;
  passwordHash: string | null;
  passwordAlgo: string;
  status: 'active' | 'locked' | 'disabled';
  failedLoginCount: number;
  lockedUntil: ISOTimestamp | null;
  mfaEnabled: boolean;
  lastLoginAt: ISOTimestamp | null;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  archivedAt: ISOTimestamp | null;
}

export type RoleName = 'user' | 'admin' | 'support';

export interface Account {
  id: UUID;
  tenantId: UUID;
  kind: 'bank' | 'income_source';
  name: string;
  institution: string | null;
  currency: string;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  archivedAt: ISOTimestamp | null;
}

export interface Document {
  id: UUID;
  tenantId: UUID;
  accountId: UUID | null;
  docType: 'bank_statement' | 'payslip';
  filePath: string;
  fileHash: string;
  mimeType: string;
  byteSize: number;
  parserId: string | null;
  parseStatus: 'ok' | 'partial' | 'failed';
  parseMeta: unknown;
  uploadedAt: ISOTimestamp;
  archivedAt: ISOTimestamp | null;
  /** Raw file bytes, for runtimes with no filesystem (browser/on-device). Null when stored via filePath instead. */
  blobData: Uint8Array | null;
}

export interface SalarySlip {
  id: UUID;
  tenantId: UUID;
  accountId: UUID;
  sourceDocumentId: UUID;
  periodStart: ISODate;
  periodEnd: ISODate;
  payDate: ISODate | null;
  grossAmount: Cents;
  netAmount: Cents;
  currency: string;
  employerName: string | null;
  employeeName: string | null;
  periodLabel: string | null;
  notes: string | null;
  confirmed: boolean;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  archivedAt: ISOTimestamp | null;
}

export type SalaryComponentType =
  | 'earning'
  | 'deduction'
  | 'contribution'
  | 'allowance'
  | 'tax';

export interface SalaryComponent {
  id: UUID;
  tenantId: UUID;
  salarySlipId: UUID;
  componentType: SalaryComponentType;
  section: string | null;
  code: string | null;
  label: string;
  amount: Cents;
  isTaxable: boolean | null;
  confidence: number;
  displayOrder: number;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

export interface BankStatement {
  id: UUID;
  tenantId: UUID;
  accountId: UUID;
  sourceDocumentId: UUID;
  periodStart: ISODate | null;
  periodEnd: ISODate | null;
  openingBalance: Cents | null;
  closingBalance: Cents | null;
  currency: string;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  archivedAt: ISOTimestamp | null;
}

export interface Transaction {
  id: UUID;
  tenantId: UUID;
  accountId: UUID;
  bankStatementId: UUID | null;
  sourceDocumentId: UUID;
  sourceRow: number | null;
  txnDate: ISODate;
  descriptionRaw: string;
  descriptionNorm: string;
  amount: Cents;
  direction: 'debit' | 'credit';
  balanceAfter: Cents | null;
  currency: string;
  categoryId: UUID | null;
  categorySource: 'rule' | 'manual' | 'auto' | 'default';
  merchant: string | null;
  confidence: number;
  flagged: boolean;
  dedupGroupId: UUID | null;
  dedupHash: string;
  reconciledExpenseId: UUID | null;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  archivedAt: ISOTimestamp | null;
}

export interface Category {
  id: UUID;
  tenantId: UUID;
  name: string;
  parentId: UUID | null;
  isSystem: boolean;
  color: string | null;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  archivedAt: ISOTimestamp | null;
}

export interface CategoryRule {
  id: UUID;
  tenantId: UUID;
  matchType: 'contains' | 'regex' | 'merchant' | 'amount_range';
  pattern: string;
  categoryId: UUID;
  priority: number;
  learned: boolean;
  hitCount: number;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  archivedAt: ISOTimestamp | null;
}

export interface ManualExpense {
  id: UUID;
  tenantId: UUID;
  txnDate: ISODate;
  amount: Cents;
  currency: string;
  categoryId: UUID | null;
  note: string | null;
  reconciledTransactionId: UUID | null;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  archivedAt: ISOTimestamp | null;
}

export interface UserSettings {
  userId: UUID;
  tenantId: UUID;
  displayName: string | null;
  theme: 'light' | 'dark' | 'system';
  currency: string;
  chartType: 'bar' | 'line';
  defaultMonth: string;
  layout: 'auto' | 'sidebar' | 'bottomnav';
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

export interface UserSession {
  id: UUID;
  tenantId: UUID;
  userId: UUID;
  refreshTokenHash: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: ISOTimestamp;
  lastUsedAt: ISOTimestamp;
  expiresAt: ISOTimestamp;
  revokedAt: ISOTimestamp | null;
}

export interface MerchantRule {
  tenantId: UUID;
  merchant: string;
  category: string;
  source: 'system' | 'user_override';
  confidence: number;
  lastUpdated: ISOTimestamp;
}

export interface CashEntry {
  id: UUID;
  tenantId: UUID;
  entryDate: ISODate;
  direction: 'inflow' | 'outflow';
  amount: Cents;
  currency: string;
  categoryId: UUID | null;
  note: string | null;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  archivedAt: ISOTimestamp | null;
}

export interface Goal {
  id: UUID;
  tenantId: UUID;
  name: string;
  goalType: 'house' | 'car' | 'vacation' | 'emergency' | 'custom';
  targetAmount: Cents;
  currentSavings: Cents;
  monthlyContribution: Cents;
  targetDate: ISODate | null;
  categoryId: UUID | null;
  icon: string | null;
  priority: number;
  status: 'active' | 'achieved' | 'paused' | 'archived';
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  archivedAt: ISOTimestamp | null;
}

export interface GoalContribution {
  id: UUID;
  tenantId: UUID;
  goalId: UUID;
  amount: Cents;
  contributedAt: ISODate;
  source: 'manual' | 'auto_detected';
  sourceTransactionId: UUID | null;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

export interface IssueLog {
  id: UUID;
  tenantId: UUID;
  source: 'system' | 'user';
  kind: string;
  severity: 'info' | 'warning' | 'error';
  entityType: string | null;
  entityId: UUID | null;
  status: 'open' | 'resolved' | 'dismissed';
  detail: unknown;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  resolvedAt: ISOTimestamp | null;
}

export interface AuditLog {
  id: UUID;
  tenantId: UUID;
  actor: string;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: UUID | null;
  before: unknown;
  after: unknown;
  context: unknown;
  at: ISOTimestamp;
}
