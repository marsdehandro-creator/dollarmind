/**
 * DocumentRepository port. Stores the record of an uploaded file (provenance).
 */
import type { Document } from '../models/index.js';

export interface DocumentRepository {
  create(doc: Document): Promise<Document>;
  updateParseStatus(id: string, status: Document['parseStatus'], meta: unknown): Promise<void>;
  findByHash(tenantId: string, fileHash: string): Promise<Document | null>;
}
