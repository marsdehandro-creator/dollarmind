/**
 * On-device PDF text extraction via pdf.js — the browser/Capacitor-webview
 * counterpart to backend/pdf.ts's pdf-parse-based extractor. Same PdfExtract
 * shape and same scanned/multi-column heuristics (shared via pdfTypes.ts), so
 * downstream parsing behaves identically regardless of which adapter ran.
 */
import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api.js';
// Vite bundles the worker as a fingerprinted asset and gives us its final URL.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { looksMultiColumn, looksScanned, type PdfExtract, type PdfExtractorFn } from '@dollarmind/core/ingestion/pdfTypes.js';
import { ingestError } from '@dollarmind/core/utils/ingestErrors.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * pdf.js's getTextContent() returns a flat list of positioned text fragments
 * with no line breaks — joining them with a plain space (as a first pass did)
 * runs unrelated rows together and corrupts field parsing (e.g. "Basic Salary
 * 52,000.00 Housing Allowance 4,500.00..." with no boundary between fields).
 * Reconstruct rows by grouping fragments with close y-coordinates, then
 * ordering each row left-to-right by x — the standard technique for turning
 * pdf.js's coordinate-based output back into readable line-oriented text.
 */
function reconstructLines(items: (TextItem | TextMarkedContent)[]): string {
  type Frag = { x: number; y: number; str: string };
  const frags: Frag[] = [];
  for (const item of items) {
    if (!('str' in item) || !item.str) continue;
    const transform = 'transform' in item ? item.transform : undefined;
    frags.push({ x: transform?.[4] ?? 0, y: transform?.[5] ?? 0, str: item.str });
  }
  if (frags.length === 0) return '';

  // Group fragments into rows: sort by y (descending — PDF space is bottom-up),
  // then bucket fragments whose y falls within a small tolerance of the row's start.
  const Y_TOLERANCE = 2;
  const sorted = [...frags].sort((a, b) => b.y - a.y);
  const rows: Frag[][] = [];
  for (const frag of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0].y - frag.y) <= Y_TOLERANCE) {
      row.push(frag);
    } else {
      rows.push([frag]);
    }
  }

  return rows
    .map((row) =>
      row
        .sort((a, b) => a.x - b.x)
        .map((f) => f.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .join('\n');
}

export const extractPdfBrowser: PdfExtractorFn = async (bytes: Uint8Array): Promise<PdfExtract> => {
  let pdf: pdfjsLib.PDFDocumentProxy;
  try {
    // pdf.js transfers (detaches) the buffer it's given to its worker via
    // postMessage — pass a copy so the caller's original bytes (still needed
    // afterward for hashing and blob storage) stay intact.
    pdf = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
  } catch {
    throw ingestError('EXTRACTION_FAILED', {
      message: 'This PDF could not be read — it may be corrupted or encrypted.',
    });
  }

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(reconstructLines(content.items));
  }

  const text = pages.join('\n\f\n').trim();
  return {
    text,
    pages: pages.filter(Boolean).length ? pages.filter(Boolean) : [text],
    pageCount: pdf.numPages,
    scanned: looksScanned(text),
    multiColumn: looksMultiColumn(text),
  };
};
