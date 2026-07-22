/**
 * Category local data access. Calls the on-device categoryRepository /
 * transactionCategorizationService directly.
 */
import { getContainer } from '../local/container.js';
import type { TransactionDto } from './transactionService.js';

export interface Category {
  id: string;
  name: string;
  isSystem: boolean;
  color: string | null;
}

export async function listCategories(): Promise<Category[]> {
  const { categoryRepository, tenantId } = await getContainer();
  const categories = await categoryRepository.listByTenant(tenantId);
  return categories as unknown as Category[];
}

/** Manual override → triggers adaptive learning. */
export async function updateTransactionCategory(
  transactionId: string,
  categoryId: string,
): Promise<{ transaction: TransactionDto; learnedRule: { id: string } | null }> {
  const { transactionCategorizationService, tenantId } = await getContainer();
  const result = await transactionCategorizationService.overrideCategory(tenantId, transactionId, categoryId);
  return result as unknown as { transaction: TransactionDto; learnedRule: { id: string } | null };
}

/** Auto-categorize all uncategorized transactions. */
export async function categorizeAll(): Promise<{ categorized: number; total: number }> {
  const { transactionCategorizationService, tenantId } = await getContainer();
  const result = await transactionCategorizationService.categorizeUncategorized(tenantId);
  return result as unknown as { categorized: number; total: number };
}
