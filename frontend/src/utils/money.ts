/**
 * Money display helpers. Amounts arrive as integer cents.
 *
 * The active currency symbol is configurable at runtime so the user's currency
 * preference applies globally without every caller passing it (set by
 * PreferencesContext on load).
 */
const SYMBOLS: Record<string, string> = { ZAR: 'R', USD: '$', EUR: '€', GBP: '£' };

let currencyCode = 'ZAR';

export function setCurrency(code: string): void {
  currencyCode = code;
}

export function currencySymbol(): string {
  return SYMBOLS[currencyCode] ?? currencyCode + ' ';
}

/** Format integer cents using the active currency, e.g. 1234 -> "R12.34". */
export function formatZar(cents: number): string {
  return `${currencySymbol()}${(cents / 100).toFixed(2)}`;
}

/** Alias with a currency-neutral name for new call sites. */
export const formatMoney = formatZar;
