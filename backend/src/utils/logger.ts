/**
 * Minimal logger placeholder. Never log secrets or raw financial detail
 * (docs/security.md §5.3). Phase 6 swaps in a structured logger.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

function log(level: Level, msg: string, meta?: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](`[${level}] ${msg}`, meta ?? '');
}

export const logger = {
  debug: (m: string, meta?: Record<string, unknown>) => log('debug', m, meta),
  info: (m: string, meta?: Record<string, unknown>) => log('info', m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => log('warn', m, meta),
  error: (m: string, meta?: Record<string, unknown>) => log('error', m, meta),
};
