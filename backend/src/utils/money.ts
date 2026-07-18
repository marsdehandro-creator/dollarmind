/**
 * Money helpers. All amounts are integer cents (docs/data-model.md §1).
 */
export type Cents = number;

/** "12.34" or 12.34 -> 1234 cents. Rounds to nearest cent. */
export function toCents(value: string | number): Cents {
  const n = typeof value === 'string' ? Number(value.replace(/[^0-9.-]/g, '')) : value;
  return Math.round(n * 100);
}

/** 1234 cents -> "12.34". */
export function fromCents(cents: Cents): string {
  return (cents / 100).toFixed(2);
}

/** Format for display, e.g. 1234 -> "R12.34". */
export function formatZar(cents: Cents): string {
  return `R${fromCents(cents)}`;
}
