/**
 * Portable OCR types + the no-op default provider. Zero Node dependencies —
 * safe for extract.ts (and the browser bundle) to import directly. The real
 * Tesseract-backed provider (Node-only, lazy-loaded) lives in ocr.ts.
 */
import { ingestError } from '../utils/ingestErrors.js';

export interface OcrResult {
  text: string;
  confidence: number; // 0..1
}

export interface OcrProvider {
  isAvailable(): boolean;
  recognize(bytes: Uint8Array): Promise<OcrResult>;
}

/** Reports OCR as unavailable, so the pipeline raises the correct business error (503 OCR_UNAVAILABLE). */
export class NullOcrProvider implements OcrProvider {
  isAvailable(): boolean {
    return false;
  }
  async recognize(): Promise<OcrResult> {
    throw ingestError('OCR_UNAVAILABLE');
  }
}
