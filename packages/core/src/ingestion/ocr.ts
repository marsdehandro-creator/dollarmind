/**
 * OCR extraction layer (Section 3).
 *
 * Pluggable provider. The default NullOcrProvider reports OCR as unavailable so
 * the pipeline returns the correct business error (503 OCR_UNAVAILABLE). A
 * TesseractOcrProvider is available opt-in (DOLLARMIND_OCR=tesseract) and lazily
 * loads tesseract.js — an optional dependency — so the core install/build stays
 * lean and offline-friendly.
 */
import { createRequire } from 'node:module';
import { ingestError } from '../utils/ingestErrors.js';
import { NullOcrProvider, type OcrProvider, type OcrResult } from './ocrTypes.js';

export { NullOcrProvider, type OcrProvider, type OcrResult };

const nodeRequire = createRequire(import.meta.url);

/** Lazily backed by tesseract.js if it is installed. */
export class TesseractOcrProvider implements OcrProvider {
  isAvailable(): boolean {
    try {
      nodeRequire.resolve('tesseract.js');
      return true;
    } catch {
      return false;
    }
  }

  async recognize(bytes: Uint8Array): Promise<OcrResult> {
    let tesseract: {
      recognize: (img: Buffer, lang: string, opts?: Record<string, unknown>) => Promise<{ data: { text: string; confidence: number } }>;
    };
    try {
      tesseract = nodeRequire('tesseract.js');
    } catch {
      throw ingestError('OCR_UNAVAILABLE');
    }
    try {
      // OCR_PATH may point at a local tessdata/models directory for offline use.
      const opts = process.env.OCR_PATH ? { langPath: process.env.OCR_PATH, cachePath: process.env.OCR_PATH } : undefined;
      const { data } = await tesseract.recognize(Buffer.from(bytes), 'eng', opts);
      return { text: data.text ?? '', confidence: (data.confidence ?? 0) / 100 };
    } catch {
      throw ingestError('EXTRACTION_FAILED', { message: 'OCR failed to read this file.' });
    }
  }
}

let provider: OcrProvider | null = null;

/** OCR is active when OCR_ENABLED=true (alias: DOLLARMIND_OCR=tesseract). */
function ocrEnabled(): boolean {
  return process.env.OCR_ENABLED === 'true' || process.env.DOLLARMIND_OCR === 'tesseract';
}

export function getOcrProvider(): OcrProvider {
  if (!provider) {
    provider = ocrEnabled() ? new TesseractOcrProvider() : new NullOcrProvider();
  }
  return provider;
}

/** Test/override hook. */
export function setOcrProvider(p: OcrProvider | null): void {
  provider = p;
}
