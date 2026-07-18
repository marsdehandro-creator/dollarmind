/**
 * SQLite-backed DocumentRepository.
 */
import type { Db } from '../../db/connection.js';
import type { Document } from '../../models/index.js';
import type { DocumentRepository } from '../DocumentRepository.js';
import { nowIso } from '../../utils/id.js';
import { rowToDocument, type Row } from './rowMappers.js';

export class SqliteDocumentRepository implements DocumentRepository {
  constructor(private readonly db: Db) {}

  async create(doc: Document): Promise<Document> {
    this.db
      .prepare(
        `INSERT INTO document (id, tenant_id, account_id, doc_type, file_path, file_hash,
           mime_type, byte_size, parser_id, parse_status, parse_meta, uploaded_at, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        doc.id,
        doc.tenantId,
        doc.accountId,
        doc.docType,
        doc.filePath,
        doc.fileHash,
        doc.mimeType,
        doc.byteSize,
        doc.parserId,
        doc.parseStatus,
        doc.parseMeta == null ? null : JSON.stringify(doc.parseMeta),
        doc.uploadedAt,
        doc.archivedAt,
      );
    return doc;
  }

  async updateParseStatus(id: string, status: Document['parseStatus'], meta: unknown): Promise<void> {
    this.db
      .prepare('UPDATE document SET parse_status = ?, parse_meta = ? WHERE id = ?')
      .run(status, meta == null ? null : JSON.stringify(meta), id);
  }

  async findByHash(tenantId: string, fileHash: string): Promise<Document | null> {
    const row = this.db
      .prepare('SELECT * FROM document WHERE tenant_id = ? AND file_hash = ?')
      .get(tenantId, fileHash) as Row | undefined;
    return row ? rowToDocument(row) : null;
  }
}
