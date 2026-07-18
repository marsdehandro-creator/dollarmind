/**
 * LocalCashEntryService — record and list cash inflows/outflows.
 */
import type { CashEntryService, CreateCashEntryInput } from './interfaces/CashEntryService.js';
import type { CashEntryRepository } from '../repositories/CashEntryRepository.js';
import type { AuditService } from './interfaces/AuditService.js';
import type { CashEntry } from '../models/index.js';
import { newId, nowIso } from '../utils/id.js';
import { ValidationError } from '../utils/errors.js';

export class LocalCashEntryService implements CashEntryService {
  constructor(
    private readonly entries: CashEntryRepository,
    private readonly audit: AuditService,
  ) {}

  async create(tenantId: string, input: CreateCashEntryInput): Promise<CashEntry> {
    if (!input.entryDate || !Number.isFinite(input.amount) || input.amount <= 0) {
      throw new ValidationError('entryDate and a positive amount are required');
    }
    if (input.direction !== 'inflow' && input.direction !== 'outflow') {
      throw new ValidationError("direction must be 'inflow' or 'outflow'");
    }
    const now = nowIso();
    const entry: CashEntry = {
      id: newId(),
      tenantId,
      entryDate: input.entryDate,
      direction: input.direction,
      amount: Math.round(input.amount),
      currency: 'ZAR',
      categoryId: input.categoryId ?? null,
      note: input.note ?? null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    await this.entries.create(entry);
    await this.audit.record({
      tenantId,
      actor: `user:${tenantId}`,
      action: 'cash.created',
      entityType: 'cash_entry',
      entityId: entry.id,
      context: { direction: entry.direction },
    });
    return entry;
  }

  list(tenantId: string): Promise<CashEntry[]> {
    return this.entries.listByTenant(tenantId);
  }
}
