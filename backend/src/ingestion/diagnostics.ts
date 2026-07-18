/**
 * Ingestion diagnostics collector (Section 8). Records each pipeline step for
 * logging and for returning a summary to the client.
 */
import { logger } from '../utils/logger.js';

export interface DiagnosticStep {
  step: string;
  detail?: unknown;
  at: string;
}

export class Diagnostics {
  private readonly steps: DiagnosticStep[] = [];

  constructor(private readonly context: string) {}

  record(step: string, detail?: unknown): void {
    this.steps.push({ step, detail, at: new Date().toISOString() });
    logger.debug(`ingest[${this.context}]: ${step}`, detail && typeof detail === 'object' ? (detail as Record<string, unknown>) : { detail });
  }

  list(): DiagnosticStep[] {
    return this.steps;
  }

  /** Compact summary (step names) for API responses. */
  summary(): string[] {
    return this.steps.map((s) => s.step);
  }
}
