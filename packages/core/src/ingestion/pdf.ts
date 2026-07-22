/**
 * PDF extraction layer (Section 2) — pdf-parse, lazily loaded.
 *
 * Extracts embedded text. A PDF with little or no extractable text is treated as
 * scanned (image-only) and routed to OCR. Corrupt PDFs raise EXTRACTION_FAILED.
 */
import { createRequire } from 'node:module';
import { ingestError } from '../utils/ingestErrors.js';
import { looksMultiColumn, looksScanned, type PdfExtract } from './pdfTypes.js';

export type { PdfExtract };

const nodeRequire = createRequire(import.meta.url);

type PdfParseFn = (data: Buffer, opts?: unknown) => Promise<{ text: string; numpages: number }>;

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
  return {
    text,
    pages: pages.length ? pages : [text],
    pageCount: data.numpages ?? pages.length ?? 1,
    scanned: looksScanned(text),
    multiColumn: looksMultiColumn(text),
  };
}
