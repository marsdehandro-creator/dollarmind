/**
 * Transaction table + category-override modal, wired together. Shared by the
 * Transactions and Categories pages.
 */
import { useMemo, useState } from 'react';
import { TransactionTable } from './TransactionTable.js';
import { CategoryOverrideModal } from '../categories/CategoryOverrideModal.js';
import type { Category } from '../../services/categoryService.js';
import type { TransactionDto } from '../../services/transactionService.js';

interface Props {
  transactions: TransactionDto[];
  categories: Category[];
  onChanged: () => void;
}

export function EditableTransactionList({ transactions, categories, onChanged }: Props) {
  const [selected, setSelected] = useState<TransactionDto | null>(null);

  const categoryNames = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  return (
    <>
      <TransactionTable transactions={transactions} categoryNames={categoryNames} onEditCategory={setSelected} />
      {selected && (
        <CategoryOverrideModal
          transaction={selected}
          categories={categories}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            onChanged();
          }}
        />
      )}
    </>
  );
}
