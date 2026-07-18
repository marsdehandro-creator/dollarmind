/**
 * Smart business error mapping for ingestion (Phase 14, Option A).
 *
 * Every ingestion failure maps a technical cause to a business error with a
 * stable code, human-friendly message, severity, actionable suggestion, and an
 * HTTP status. The error handler serializes these to the response body:
 *   { error, message, severity, suggestion }
 */
import { HttpError } from './errors.js';

export type Severity = 'info' | 'warning' | 'critical';

export interface IngestErrorSpec {
  status: number;
  severity: Severity;
  message: string;
  suggestion: string;
}

export const INGEST_ERRORS = {
  PDF_UNSUPPORTED: {
    status: 400,
    severity: 'warning',
    message: 'This PDF could not be read as a supported document.',
    suggestion: 'Export the document as CSV or a text-based PDF and upload again.',
  },
  FORMAT_UNRECOGNIZED: {
    status: 400,
    severity: 'warning',
    message: "We couldn't recognise this file's format.",
    suggestion: 'Upload a CSV export from your bank or payroll, or check the file is correct.',
  },
  COLUMN_LAYOUT_UNSUPPORTED: {
    status: 400,
    severity: 'warning',
    message: 'The column layout in this file could not be reconstructed.',
    suggestion: 'Export a standard CSV with clear columns (date, description, amount).',
  },
  MISSING_FIELDS: {
    status: 422,
    severity: 'warning',
    message: 'Some required fields were missing from the document.',
    suggestion: 'Check the document includes the required values, or enter them manually.',
  },
  VALIDATION_FAILED: {
    status: 422,
    severity: 'warning',
    message: 'The extracted data failed validation.',
    suggestion: 'Review the document and re-upload, or correct the values manually.',
  },
  DATASET_TOO_LARGE: {
    status: 422,
    severity: 'warning',
    message: 'This file contains more rows than can be processed in one upload.',
    suggestion: 'Split the statement into smaller date ranges and upload each part.',
  },
  OCR_REQUIRED: {
    status: 422,
    severity: 'info',
    message: 'This looks like a scanned document that needs OCR to read.',
    suggestion: 'Upload a text-based PDF or CSV export, or enable OCR.',
  },
  OCR_UNAVAILABLE: {
    status: 503,
    severity: 'critical',
    message: 'This file needs OCR to read, but the OCR engine is not available.',
    suggestion: 'Enable the OCR engine (tesseract), or upload a text-based export.',
  },
  EXTRACTION_FAILED: {
    status: 500,
    severity: 'critical',
    message: 'We could not extract data from this file.',
    suggestion: 'The file may be corrupted — try re-exporting it and uploading again.',
  },
} as const satisfies Record<string, IngestErrorSpec>;

export type IngestErrorCode = keyof typeof INGEST_ERRORS;

export class IngestError extends HttpError {
  readonly severity: Severity;
  readonly suggestion: string;

  constructor(code: IngestErrorCode, overrides?: Partial<Pick<IngestErrorSpec, 'message' | 'suggestion'>>) {
    const spec = INGEST_ERRORS[code];
    super(spec.status, overrides?.message ?? spec.message, code);
    this.severity = spec.severity;
    this.suggestion = overrides?.suggestion ?? spec.suggestion;
  }
}

export function ingestError(
  code: IngestErrorCode,
  overrides?: Partial<Pick<IngestErrorSpec, 'message' | 'suggestion'>>,
): IngestError {
  return new IngestError(code, overrides);
}
