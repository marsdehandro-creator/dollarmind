/**
 * useTransactions hook (placeholder). Fetches the ledger on mount.
 */
import { useEffect, useState } from 'react';
import { listTransactions, type TransactionDto } from '../services/transactionService.js';

export function useTransactions() {
  const [data, setData] = useState<TransactionDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listTransactions()
      .then((rows) => active && setData(rows))
      .catch(() => active && setData([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return { data, loading };
}
