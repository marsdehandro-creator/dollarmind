/**
 * On-device OCR via tesseract.js's browser build, configured to load its
 * worker/wasm-core/trained-data entirely from locally-bundled assets (copied
 * by scripts/copy-assets.mjs) instead of a CDN — required for OCR to work
 * fully offline. Same OcrProvider contract as backend/ocr.ts's
 * TesseractOcrProvider, so extract.ts's dispatch logic is unchanged.
 */
import { createWorker, type Worker } from 'tesseract.js';
import { NullOcrProvider, type OcrProvider, type OcrResult } from '@dollarmind/core/ingestion/ocrTypes.js';
import { ingestError } from '@dollarmind/core/utils/ingestErrors.js';

const ASSET_BASE = `${import.meta.env.BASE_URL}assets/tesseract`;
// KNOWN ISSUE: worker init has been observed to hang indefinitely in some
// environments with no error surfaced (root cause not yet isolated — no
// worker/core/lang asset requests are ever seen, suggesting the Worker never
// finishes constructing). This timeout turns that hang into a clear, timely
// error instead of a permanent spinner while that's investigated further.
const WORKER_INIT_TIMEOUT_MS = 30_000;

let workerPromise: Promise<Worker> | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = withTimeout(
      createWorker('eng', 1, {
        workerPath: `${ASSET_BASE}/worker.min.js`,
        corePath: `${ASSET_BASE}/tesseract-core-simd-lstm.wasm.js`,
        langPath: ASSET_BASE,
        gzip: true,
      }),
      WORKER_INIT_TIMEOUT_MS,
      'OCR worker did not start in time',
    ).catch((err) => {
      workerPromise = null; // allow retry on the next upload rather than caching a dead promise
      throw err;
    });
  }
  return workerPromise;
}

class BrowserOcrProvider implements OcrProvider {
  isAvailable(): boolean {
    return true;
  }

  async recognize(bytes: Uint8Array): Promise<OcrResult> {
    let worker: Worker;
    try {
      worker = await getWorker();
    } catch {
      throw ingestError('OCR_UNAVAILABLE', {
        message: 'On-device OCR failed to start.',
        suggestion: 'Try again, or upload a text-based PDF/CSV export instead of a scanned image.',
      });
    }
    try {
      const blob = new Blob([bytes.slice().buffer]);
      const {
        data: { text, confidence },
      } = await worker.recognize(blob);
      return { text: text ?? '', confidence: (confidence ?? 0) / 100 };
    } catch {
      throw ingestError('EXTRACTION_FAILED', { message: 'OCR failed to read this file.' });
    }
  }
}

/** Falls back to "OCR unavailable" if the browser can't run WebAssembly workers at all. */
export function getBrowserOcrProvider(): OcrProvider {
  if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') return new NullOcrProvider();
  return new BrowserOcrProvider();
}
