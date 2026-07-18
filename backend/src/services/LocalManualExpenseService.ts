/**
 * LocalManualExpenseService — CRUD over manual expenses.
 */
import type {
  CreateExpenseInput,
  ManualExpenseService,
  UpdateExpenseInput,
} from './interfaces/ManualExpenseService.js';
import type { ManualExpenseRepository } from '../repositories/ManualExpenseRepository.js';
import type { AuditService } from './interfaces/AuditService.js';
import type { ManualExpense } from '../models/index.js';
import { newId, nowIso } from '../utils/id.js';
import { ValidationError } from '../utils/errors.js';

export class LocalManualExpenseService implements ManualExpenseService {
  constructor(
    private readonly expenses: ManualExpenseRepository,
    private readonly audit: AuditService,
  ) {}

  async create(tenantId: string, input: CreateExpenseInput): Promise<ManualExpense> {
    if (!input.txnDate || !Number.isFinite(input.amount) || input.amount <= 0) {
      throw new ValidationError('txnDate and a positive amount are required');
    }
    const now = nowIso();
    const expense: ManualExpense = {
      id: newId(),
      tenantId,
      txnDate: input.txnDate,
      amount: Math.round(input.amount),
      currency: 'ZAR',
      categoryId: input.categoryId ?? null,
      note: input.note ?? null,
      reconciledTransactionId: null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    await this.expenses.create(expense);
    await this.audit.record({
      tenantId,
      actor: `user:${tenantId}`,
      action: 'expense.created',
      entityType: 'manual_expense',
      entityId: expense.id,
    });
    return expense;
  }

  async update(tenantId: string, id: string, patch: UpdateExpenseInput): Promise<ManualExpense> {
    const existing = await this.expenses.findById(id);
    if (!existing || existing.tenantId !== tenantId) throw new ValidationError('Expense not found');

    const updated: ManualExpense = {
      ...existing,
      txnDate: patch.txnDate ?? existing.txnDate,
      amount: patch.amount !== undefined ? Math.round(patch.amount) : existing.amount,
      categoryId: patch.categoryId !== undefined ? patch.categoryId : existing.categoryId,
      note: patch.note !== undefined ? patch.note : existing.note,
      updatedAt: nowIso(),
    };
    await this.expenses.update(updated);
    await this.audit.record({
      tenantId,
      actor: `user:${tenantId}`,
      action: 'expense.updated',
      entityType: 'manual_expense',
      entityId: id,
    });
    return updated;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const existing = await this.expenses.findById(id);
    if (!existing || existing.tenantId !== tenantId) throw new ValidationError('Expense not found');
    await this.expenses.softDelete(id);
    await this.audit.record({
      tenantId,
      actor: `user:${tenantId}`,
      action: 'expense.deleted',
      entityType: 'manual_expense',
      entityId: id,
    });
  }

  list(tenantId: string): Promise<ManualExpense[]> {
    return this.expenses.listByTenant(tenantId);
  }
}
