/**
 * Ingestion extraction layer + business error mapping.
 */
import { describe, it, expect } from 'vitest';
import { extractDocumentText, type ExtractionAdapters } from '@dollarmind/core/ingestion/extract.js';
import { NullOcrProvider, getOcrProvider } from '@dollarmind/core/ingestion/ocr.js';
import { extractPdf } from '@dollarmind/core/ingestion/pdf.js';
import { IngestError, INGEST_ERRORS } from '@dollarmind/core/utils/ingestErrors.js';
import { detectBank } from '@dollarmind/core/ingestion/formatDetect.js';

const realAdapters: ExtractionAdapters = { ocr: getOcrProvider(), extractPdf };

describe('business error registry', () => {
  it('maps codes to the documented HTTP statuses', () => {
    expect(INGEST_ERRORS.PDF_UNSUPPORTED.status).toBe(400);
    expect(INGEST_ERRORS.MISSING_FIELDS.status).toBe(422);
    expect(INGEST_ERRORS.EXTRACTION_FAILED.status).toBe(500);
    expect(INGEST_ERRORS.OCR_UNAVAILABLE.status).toBe(503);
    const e = new IngestError('FORMAT_UNRECOGNIZED');
    expect(e.status).toBe(400);
    expect(e.severity).toBe('warning');
    expect(e.suggestion).toBeTruthy();
  });
});

describe('extractDocumentText', () => {
  it('decodes text/CSV directly', async () => {
    const buffer = Buffer.from('a,b,c\n1,2,3', 'utf-8');
    const r = await extractDocumentText({ bytes: buffer, fileName: 'x.csv', mimeType: 'text/csv' }, undefined, realAdapters);
    expect(r.source).toBe('text');
    expect(r.text).toContain('a,b,c');
  });

  it('invokes pdf-parse and maps a corrupt PDF to EXTRACTION_FAILED (500)', async () => {
    const bad = Buffer.from('%PDF-1.4 not really a pdf', 'latin1');
    await expect(
      extractDocumentText({ bytes: bad, fileName: 'slip.pdf', mimeType: 'application/pdf' }, undefined, realAdapters),
    ).rejects.toMatchObject({ code: 'EXTRACTION_FAILED', status: 500 });
  });

  it('returns OCR_UNAVAILABLE (503) for an image with no OCR provider', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await expect(
      extractDocumentText(
        { bytes: png, fileName: 'scan.png', mimeType: 'image/png' },
        undefined,
        { ocr: new NullOcrProvider(), extractPdf },
      ),
    ).rejects.toMatchObject({ code: 'OCR_UNAVAILABLE', status: 503 });
  });

  it('returns FORMAT_UNRECOGNIZED (400) for unsupported types', async () => {
    const bin = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // zip
    await expect(
      extractDocumentText({ bytes: bin, fileName: 'data.zip', mimeType: 'application/zip' }, undefined, realAdapters),
    ).rejects.toMatchObject({ code: 'FORMAT_UNRECOGNIZED', status: 400 });
  });
});

describe('detectBank', () => {
  it('recognises SA banks from statement text', () => {
    expect(detectBank('FNB Cheque Account')).toBe('FNB');
    expect(detectBank('CAPITEC BANK statement')).toBe('Capitec');
    expect(detectBank('random text')).toBeNull();
  });
});
