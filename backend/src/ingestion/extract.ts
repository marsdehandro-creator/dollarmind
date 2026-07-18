/**
 * Unified text extraction entry point (Section 7, step 1).
 *
 * Dispatches by file type: text/CSV are decoded directly; PDFs are parsed for
 * embedded text and, if scanned, routed to OCR; images go to OCR. Every failure
 * path raises a business error (IngestError) with the right HTTP status.
 */
import { extractPdf } from './pdf.js';
import { getOcrProvider, type OcrProvider } from './ocr.js';
import { ingestError } from '../utils/ingestErrors.js';
import type { Diagnostics } from './diagnostics.js';

export interface ExtractInput {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
}

export interface ExtractedDoc {
  text: string;
  source: 'text' | 'pdf' | 'ocr';
  pages: number;
  warnings: string[];
}

const OCR_MIN_CONFIDENCE = 0.5;

export async function extractDocumentText(
  file: ExtractInput,
  diag?: Diagnostics,
  ocr: OcrProvider = getOcrProvider(),
): Promise<ExtractedDoc> {
  const name = file.fileName.toLowerCase();
  const mime = file.mimeType.toLowerCase();

  const isText = /^(text\/|application\/csv)/.test(mime) || /\.(txt|csv|tsv)$/.test(name);
  if (isText) {
    diag?.record('extract:text');
    return { text: Buffer.from(file.bytes).toString('utf-8'), source: 'text', pages: 1, warnings: [] };
  }

  const isPdf = mime.includes('pdf') || name.endsWith('.pdf');
  if (isPdf) {
    const pdf = await extractPdf(file.bytes);
    diag?.record('extract:pdf', { pages: pdf.pageCount, scanned: pdf.scanned, multiColumn: pdf.multiColumn });
    if (!pdf.scanned) {
      const warnings = pdf.multiColumn ? ['Multi-column layout detected — column reconstruction is best-effort.'] : [];
      return { text: pdf.text, source: 'pdf', pages: pdf.pageCount, warnings };
    }
    // Scanned PDF → OCR
    if (!ocr.isAvailable()) throw ingestError('OCR_UNAVAILABLE');
    diag?.record('extract:ocr');
    const r = await ocr.recognize(file.bytes);
    if (r.confidence < OCR_MIN_CONFIDENCE) {
      throw ingestError('EXTRACTION_FAILED', { message: 'OCR confidence was too low to trust the result.' });
    }
    return { text: r.text, source: 'ocr', pages: pdf.pageCount, warnings: [`OCR confidence ${Math.round(r.confidence * 100)}%`] };
  }

  const isImage = mime.startsWith('image/') || /\.(png|jpe?g|webp)$/.test(name);
  if (isImage) {
    if (!ocr.isAvailable()) throw ingestError('OCR_UNAVAILABLE');
    diag?.record('extract:ocr-image');
    const r = await ocr.recognize(file.bytes);
    if (r.confidence < OCR_MIN_CONFIDENCE) {
      throw ingestError('EXTRACTION_FAILED', { message: 'OCR confidence was too low to trust the result.' });
    }
    return { text: r.text, source: 'ocr', pages: 1, warnings: [`OCR confidence ${Math.round(r.confidence * 100)}%`] };
  }

  throw ingestError('FORMAT_UNRECOGNIZED');
}
