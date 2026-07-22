/**
 * Minimal ambient types for Node's built-in `node:sqlite` (experimental),
 * which @types/node@20 does not yet declare. Covers only the API we use.
 * Only referenced by the test-only nodeTestDriver.ts — production code never
 * imports node:sqlite. Remove once @types/node ships these.
 */
declare module 'node:sqlite' {
  export interface StatementSync {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }

  export class DatabaseSync {
    constructor(path: string, options?: { open?: boolean; readOnly?: boolean });
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
