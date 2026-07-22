/**
 * Text normalization + multi-column table reconstruction (Section 4/6).
 */

/** Normalize line endings, trim, drop empty lines, collapse runs of blanks. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\t/g, '    ').replace(/[  ]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Split a whitespace/fixed-width row into columns (2+ spaces = a boundary). */
export function splitColumns(line: string): string[] {
  return line.trim().split(/ {2,}|\t+/).map((c) => c.trim()).filter(Boolean);
}

/**
 * Join wrapped description lines: a line with no leading date/amount is treated
 * as a continuation of the previous row.
 */
export function joinWrappedLines(lines: string[], startsRow: (l: string) => boolean): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (out.length > 0 && !startsRow(line)) {
      out[out.length - 1] += ` ${line.trim()}`;
    } else {
      out.push(line);
    }
  }
  return out;
}
