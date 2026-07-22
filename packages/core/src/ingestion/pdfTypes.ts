/**
 * Portable PDF extraction result type + PDF extractor function shape. Zero
 * Node dependencies — safe for extract.ts (and the browser bundle) to import
 * directly. The real pdf-parse-backed extractor (Node-only) lives in pdf.ts;
 * a browser pdf.js-backed one is added in a later phase.
 */
export interface PdfExtract {
  text: string;
  pages: string[];
  pageCount: number;
  scanned: boolean;
  multiColumn: boolean;
}

export type PdfExtractorFn = (bytes: Uint8Array) => Promise<PdfExtract>;

/** Heuristic: many lines with wide internal gaps suggest a multi-column layout. Shared by every extractor adapter (pdf.ts, the browser pdf.js adapter). */
export function looksMultiColumn(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return false;
  const wideGap = lines.filter((l) => /\S {3,}\S.* {3,}\S/.test(l)).length;
  return wideGap / lines.length > 0.4;
}

/** Heuristic: very little extractable text means the PDF is likely scanned (image-only). Shared by every extractor adapter. */
export function looksScanned(text: string): boolean {
  return text.replace(/\s/g, '').length < 20;
}
