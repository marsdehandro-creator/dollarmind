/**
 * Category API client.
 */
import { apiGet, apiPost } from './apiClient.js';
import type { TransactionDto } from './transactionService.js';

export interface Category {
  id: string;
  name: string;
  isSystem: boolean;
  color: string | null;
}

export async function listCategories(): Promise<Category[]> {
  const { categories } = await apiGet<{ categories: Category[] }>('/categories/list');
  return categories;
}

/** Manual override → triggers adaptive learning on the backend. */
export function updateTransactionCategory(
  transactionId: string,
  categoryId: string,
): Promise<{ transaction: TransactionDto; learnedRule: { id: string } | null }> {
  return apiPost('/categories/update', { transactionId, categoryId });
}

/** Auto-categorize all uncategorized transactions. */
export function categorizeAll(): Promise<{ categorized: number; total: number }> {
  return apiPost('/transactions/categorize');
}
