/**
 * PDF extraction layer (Section 2) — pdf-parse, lazily loaded.
 *
 * Extracts embedded text. A PDF with little or no extractable text is treated as
 * scanned (image-only) and routed to OCR. Corrupt PDFs raise EXTRACTION_FAILED.
 */
import { createRequire } from 'node:module';
import { ingestError } from '../utils/ingestErrors.js';

const nodeRequire = createRequire(import.meta.url);

export interface PdfExtract {
  text: string;
  pages: string[];
  pageCount: number;
  scanned: boolean;
  multiColumn: boolean;
}

type PdfParseFn = (data: Buffer, opts?: unknown) => Promise<{ text: string; numpages: number }>;

/** Heuristic: many lines with wide internal gaps suggest a multi-column layout. */
function looksMultiColumn(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return false;
  const wideGap = lines.filter((l) => /\S {3,}\S.* {3,}\S/.test(l)).length;
  return wideGap / lines.length > 0.4;
}

export async function extractPdf(bytes: Uint8Array): Promise<PdfExtract> {
  let pdfParse: PdfParseFn;
  try {
    // lib path avoids pdf-parse's debug harness that reads a bundled test file
    pdfParse = nodeRequire('pdf-parse/lib/pdf-parse.js') as PdfParseFn;
  } catch {
    throw ingestError('PDF_UNSUPPORTED', {
      message: 'PDF support is not installed on the server.',
      suggestion: 'Run npm install to enable PDF parsing, or upload a CSV/TXT export.',
    });
  }

  let data: { text: string; numpages: number };
  try {
    data = await pdfParse(Buffer.from(bytes));
  } catch {
    throw ingestError('EXTRACTION_FAILED', {
      message: 'This PDF could not be read — it may be corrupted or encrypted.',
    });
  }

  const text = (data.text ?? '').trim();
  const pages = text.split('\f').map((p) => p.trim()).filter(Boolean);
  const compact = text.replace(/\s/g, '');
  return {
    text,
    pages: pages.length ? pages : [text],
    pageCount: data.numpages ?? pages.length ?? 1,
    scanned: compact.length < 20,
    multiColumn: looksMultiColumn(text),
  };
}
