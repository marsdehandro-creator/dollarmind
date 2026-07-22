/**
 * On-device RawFileStore: stores the raw uploaded file as a BLOB in the
 * document row instead of on disk (there is no filesystem to write to in the
 * browser, and no reason to use one on Android when the DB already holds it)
 * — see db/migrations/0011_document_blob.sql and docs/v2-migration-spec.md.
 */
import type { RawFileStore } from '@dollarmind/core/services/interfaces/RawFileStore.js';

export class BlobFileStore implements RawFileStore {
  constructor(private readonly kind: string) {}

  async save(docId: string, safeName: string, bytes: Uint8Array): Promise<{ filePath: string; blobData: Uint8Array }> {
    return { filePath: `local-blob://${this.kind}/${docId}-${safeName}`, blobData: bytes };
  }
}
