/**
 * Row <-> model mappers. Converts snake_case SQLite rows (with 0/1 booleans and
 * JSON-as-text) to the camelCase domain models and back.
 */
import type {
  Account,
  AuditLog,
  BankStatement,
  CashEntry,
  Category,
  CategoryRule,
  MerchantRule,
  Document,
  Goal,
  IssueLog,
  ManualExpense,
  SalaryComponent,
  SalarySlip,
  Transaction,
  User,
  UserSession,
  UserSettings,
} from '../../models/index.js';

export type Row = Record<string, unknown>;

const bool = (v: unknown): boolean => v === 1 || v === true;
const boolN = (v: unknown): boolean | null => (v === null || v === undefined ? null : bool(v));
const jsonN = (v: unknown): unknown => (v == null ? null : JSON.parse(String(v)));

export function rowToUser(r: Row): User {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    email: r.email as string,
    emailVerifiedAt: (r.email_verified_at as string) ?? null,
    passwordHash: (r.password_hash as string) ?? null,
    passwordAlgo: r.password_algo as string,
    status: r.status as User['status'],
    failedLoginCount: r.failed_login_count as number,
    lockedUntil: (r.locked_until as string) ?? null,
    mfaEnabled: bool(r.mfa_enabled),
    lastLoginAt: (r.last_login_at as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    archivedAt: (r.archived_at as string) ?? null,
  };
}

export function rowToAccount(r: Row): Account {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    kind: r.kind as Account['kind'],
    name: r.name as string,
    institution: (r.institution as string) ?? null,
    currency: r.currency as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    archivedAt: (r.archived_at as string) ?? null,
  };
}

export function rowToDocument(r: Row): Document {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    accountId: (r.account_id as string) ?? null,
    docType: r.doc_type as Document['docType'],
    filePath: r.file_path as string,
    fileHash: r.file_hash as string,
    mimeType: r.mime_type as string,
    byteSize: r.byte_size as number,
    parserId: (r.parser_id as string) ?? null,
    parseStatus: r.parse_status as Document['parseStatus'],
    parseMeta: jsonN(r.parse_meta),
    uploadedAt: r.uploaded_at as string,
    archivedAt: (r.archived_at as string) ?? null,
  };
}

export function rowToSalarySlip(r: Row): SalarySlip {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    accountId: r.account_id as string,
    sourceDocumentId: r.source_document_id as string,
    periodStart: r.period_start as string,
    periodEnd: r.period_end as string,
    payDate: (r.pay_date as string) ?? null,
    grossAmount: r.gross_amount as number,
    netAmount: r.net_amount as number,
    currency: r.currency as string,
    employerName: (r.employer_name as string) ?? null,
    employeeName: (r.employee_name as string) ?? null,
    periodLabel: (r.period_label as string) ?? null,
    notes: (r.notes as string) ?? null,
    confirmed: bool(r.confirmed),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    archivedAt: (r.archived_at as string) ?? null,
  };
}

export function rowToSalaryComponent(r: Row): SalaryComponent {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    salarySlipId: r.salary_slip_id as string,
    componentType: r.component_type as SalaryComponent['componentType'],
    section: (r.section as string) ?? null,
    code: (r.code as string) ?? null,
    label: r.label as string,
    amount: r.amount as number,
    isTaxable: boolN(r.is_taxable),
    confidence: r.confidence as number,
    displayOrder: r.display_order as number,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function rowToIssue(r: Row): IssueLog {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    source: r.source as IssueLog['source'],
    kind: r.kind as string,
    severity: r.severity as IssueLog['severity'],
    entityType: (r.entity_type as string) ?? null,
    entityId: (r.entity_id as string) ?? null,
    status: r.status as IssueLog['status'],
    detail: jsonN(r.detail),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    resolvedAt: (r.resolved_at as string) ?? null,
  };
}

export function rowToBankStatement(r: Row): BankStatement {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    accountId: r.account_id as string,
    sourceDocumentId: r.source_document_id as string,
    periodStart: (r.period_start as string) ?? null,
    periodEnd: (r.period_end as string) ?? null,
    openingBalance: (r.opening_balance as number) ?? null,
    closingBalance: (r.closing_balance as number) ?? null,
    currency: r.currency as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    archivedAt: (r.archived_at as string) ?? null,
  };
}

export function rowToTransaction(r: Row): Transaction {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    accountId: r.account_id as string,
    bankStatementId: (r.bank_statement_id as string) ?? null,
    sourceDocumentId: r.source_document_id as string,
    sourceRow: (r.source_row as number) ?? null,
    txnDate: r.txn_date as string,
    descriptionRaw: r.description_raw as string,
    descriptionNorm: r.description_norm as string,
    amount: r.amount as number,
    direction: r.direction as Transaction['direction'],
    balanceAfter: (r.balance_after as number) ?? null,
    currency: r.currency as string,
    categoryId: (r.category_id as string) ?? null,
    categorySource: r.category_source as Transaction['categorySource'],
    merchant: (r.merchant as string) ?? null,
    confidence: (r.confidence as number) ?? 1,
    flagged: bool(r.flagged),
    dedupGroupId: (r.dedup_group_id as string) ?? null,
    dedupHash: r.dedup_hash as string,
    reconciledExpenseId: (r.reconciled_expense_id as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    archivedAt: (r.archived_at as string) ?? null,
  };
}

export function rowToCategory(r: Row): Category {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    name: r.name as string,
    parentId: (r.parent_id as string) ?? null,
    isSystem: bool(r.is_system),
    color: (r.color as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    archivedAt: (r.archived_at as string) ?? null,
  };
}

export function rowToCategoryRule(r: Row): CategoryRule {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    matchType: r.match_type as CategoryRule['matchType'],
    pattern: r.pattern as string,
    categoryId: r.category_id as string,
    priority: r.priority as number,
    learned: bool(r.learned),
    hitCount: r.hit_count as number,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    archivedAt: (r.archived_at as string) ?? null,
  };
}

export function rowToManualExpense(r: Row): ManualExpense {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    txnDate: r.txn_date as string,
    amount: r.amount as number,
    currency: r.currency as string,
    categoryId: (r.category_id as string) ?? null,
    note: (r.note as string) ?? null,
    reconciledTransactionId: (r.reconciled_transaction_id as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    archivedAt: (r.archived_at as string) ?? null,
  };
}

export function rowToMerchantRule(r: Row): MerchantRule {
  return {
    tenantId: r.tenant_id as string,
    merchant: r.merchant as string,
    category: r.category as string,
    source: r.source as MerchantRule['source'],
    confidence: r.confidence as number,
    lastUpdated: r.last_updated as string,
  };
}

export function rowToCashEntry(r: Row): CashEntry {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    entryDate: r.entry_date as string,
    direction: r.direction as CashEntry['direction'],
    amount: r.amount as number,
    currency: r.currency as string,
    categoryId: (r.category_id as string) ?? null,
    note: (r.note as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    archivedAt: (r.archived_at as string) ?? null,
  };
}

export function rowToUserSettings(r: Row): UserSettings {
  return {
    userId: r.user_id as string,
    tenantId: r.tenant_id as string,
    displayName: (r.display_name as string) ?? null,
    theme: r.theme as UserSettings['theme'],
    currency: r.currency as string,
    chartType: r.chart_type as UserSettings['chartType'],
    defaultMonth: r.default_month as string,
    layout: (r.layout as UserSettings['layout']) ?? 'auto',
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function rowToUserSession(r: Row): UserSession {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    userId: r.user_id as string,
    refreshTokenHash: r.refresh_token_hash as string,
    userAgent: (r.user_agent as string) ?? null,
    ip: (r.ip as string) ?? null,
    createdAt: r.created_at as string,
    lastUsedAt: r.last_used_at as string,
    expiresAt: r.expires_at as string,
    revokedAt: (r.revoked_at as string) ?? null,
  };
}

export function rowToGoal(r: Row): Goal {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    name: r.name as string,
    goalType: r.goal_type as Goal['goalType'],
    targetAmount: r.target_amount as number,
    currentSavings: r.current_savings as number,
    monthlyContribution: r.monthly_contribution as number,
    targetDate: (r.target_date as string) ?? null,
    categoryId: (r.category_id as string) ?? null,
    icon: (r.icon as string) ?? null,
    priority: r.priority as number,
    status: r.status as Goal['status'],
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    archivedAt: (r.archived_at as string) ?? null,
  };
}

export function rowToAudit(r: Row): AuditLog {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    actor: r.actor as string,
    actorRole: (r.actor_role as string) ?? null,
    action: r.action as string,
    entityType: (r.entity_type as string) ?? null,
    entityId: (r.entity_id as string) ?? null,
    before: jsonN(r.before),
    after: jsonN(r.after),
    context: jsonN(r.context),
    at: r.at as string,
  };
}
