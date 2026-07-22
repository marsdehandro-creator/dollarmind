/**
 * Server-side RawFileStore: writes the raw uploaded file to local disk for
 * provenance (docs/architecture.md §4, §5) — the exact behavior
 * LocalSalarySlipService/LocalStatementImportService had before that logic
 * was extracted into this injectable port (docs/v2-migration-spec.md).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { RawFileStore } from '@dollarmind/core/services/interfaces/RawFileStore.js';

export class NodeFileStore implements RawFileStore {
  private readonly dir: string;

  constructor(subdir: string) {
    this.dir = resolve(process.cwd(), 'uploads', subdir);
    mkdirSync(this.dir, { recursive: true });
  }

  async save(docId: string, safeName: string, bytes: Uint8Array): Promise<{ filePath: string; blobData: null }> {
    const filePath = join(this.dir, `${docId}-${safeName}`);
    writeFileSync(filePath, bytes);
    return { filePath, blobData: null };
  }
}
