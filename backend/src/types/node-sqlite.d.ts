/**
 * Minimal ambient types for Node's built-in `node:sqlite` (experimental),
 * which @types/node@20 does not yet declare. Covers only the API we use.
 * Remove this file once @types/node is bumped to a version that ships them.
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
