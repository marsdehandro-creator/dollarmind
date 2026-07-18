/**
 * Filter controls for the transaction ledger (docs/requirements.md F3).
 * Amount inputs are in rand; converted to cents before querying.
 */
import { useState, type FormEvent } from 'react';
import type { TransactionFilterCriteria } from '../../services/transactionService.js';

interface Props {
  onApply: (criteria: TransactionFilterCriteria) => void;
  onReset: () => void;
}

export function TransactionFilters({ onApply, onReset }: Props) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [merchant, setMerchant] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [direction, setDirection] = useState<'' | 'debit' | 'credit'>('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const criteria: TransactionFilterCriteria = {};
    if (dateFrom) criteria.dateFrom = dateFrom;
    if (dateTo) criteria.dateTo = dateTo;
    if (merchant.trim()) criteria.merchant = merchant.trim();
    if (amountMin) criteria.amountMin = Math.round(Number(amountMin) * 100);
    if (amountMax) criteria.amountMax = Math.round(Number(amountMax) * 100);
    if (direction) criteria.direction = direction;
    onApply(criteria);
  }

  function reset() {
    setDateFrom('');
    setDateTo('');
    setMerchant('');
    setAmountMin('');
    setAmountMax('');
    setDirection('');
    onReset();
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
      <label>From<br /><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
      <label>To<br /><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
      <label>Merchant<br /><input type="text" value={merchant} placeholder="e.g. woolworths" onChange={(e) => setMerchant(e.target.value)} /></label>
      <label>Min (R)<br /><input type="number" step="0.01" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} style={{ width: 90 }} /></label>
      <label>Max (R)<br /><input type="number" step="0.01" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} style={{ width: 90 }} /></label>
      <label>Direction<br />
        <select value={direction} onChange={(e) => setDirection(e.target.value as '' | 'debit' | 'credit')}>
          <option value="">Any</option>
          <option value="debit">Debit</option>
          <option value="credit">Credit</option>
        </select>
      </label>
      <button type="submit">Apply</button>
      <button type="button" onClick={reset}>Reset</button>
    </form>
  );
}
