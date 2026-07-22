/**
 * Persists the raw bytes of an uploaded document, returning the Document
 * fields that describe where it ended up. Kept as an injected port (rather
 * than each service doing I/O directly) so the same upload service works on
 * both a filesystem-backed server and a filesystem-less browser/on-device
 * runtime — see docs/v2-migration-spec.md's core principle.
 */
export interface RawFileStore {
  save(
    docId: string,
    safeName: string,
    bytes: Uint8Array,
  ): Promise<{ filePath: string; blobData: Uint8Array | null }>;
}
