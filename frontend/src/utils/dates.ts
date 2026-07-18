/**
 * Date helpers (frontend). SA tax year runs 1 Mar – 28/29 Feb.
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA');
}

/** Returns the SA tax-year label for a date, e.g. "2026/2027". */
export function taxYearLabel(iso: string): string {
  const d = new Date(iso);
  const year = d.getMonth() >= 2 ? d.getFullYear() : d.getFullYear() - 1; // Mar = month 2
  return `${year}/${year + 1}`;
}
