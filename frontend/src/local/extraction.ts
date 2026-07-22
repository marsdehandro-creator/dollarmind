/**
 * On-device extraction adapters (Phase 3). Text/CSV/TSV, text-based PDFs, and
 * scanned/image documents (via OCR) all work fully offline — see
 * pdfExtractor.ts and ocrProvider.ts for the pdf.js / tesseract.js adapters.
 */
import { extractPdfBrowser } from './pdfExtractor.js';
import { getBrowserOcrProvider } from './ocrProvider.js';
import type { ExtractionAdapters } from '@dollarmind/core/ingestion/extract.js';

export const extractionAdapters: ExtractionAdapters = {
  ocr: getBrowserOcrProvider(),
  extractPdf: extractPdfBrowser,
};
