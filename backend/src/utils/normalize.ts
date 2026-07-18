/**
 * Description normalization for matching/dedup (docs/data-model.md §4.3).
 * Placeholder: lowercase, collapse whitespace, strip obvious noise.
 */
export function normalizeDescription(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[*#]/g, ' ')
    .replace(/\b\d{6,}\b/g, ' ') // strip long reference/auth numbers
    .replace(/\s+/g, ' ')
    .trim();
}
