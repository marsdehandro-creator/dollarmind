/**
 * On-device (LocalDbDriver-backed) DocumentRepository. Same SQL/shape as
 * SqliteDocumentRepository.
 */
import type { LocalDbDriver } from '../../db/LocalDbDriver.js';
import type { Document } from '../../models/index.js';
import type { DocumentRepository } from '../DocumentRepository.js';
import { rowToDocument, type Row } from '../rowMappers.js';

export class LocalDocumentRepository implements DocumentRepository {
  constructor(private readonly db: LocalDbDriver) {}

  async create(doc: Document): Promise<Document> {
    await this.db.run(
      `INSERT INTO document (id, tenant_id, account_id, doc_type, file_path, file_hash,
         mime_type, byte_size, parser_id, parse_status, parse_meta, uploaded_at, archived_at, blob_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
        doc.blobData,
      ],
    );
    return doc;
  }

  async updateParseStatus(id: string, status: Document['parseStatus'], meta: unknown): Promise<void> {
    await this.db.run('UPDATE document SET parse_status = ?, parse_meta = ? WHERE id = ?', [
      status,
      meta == null ? null : JSON.stringify(meta),
      id,
    ]);
  }

  async findByHash(tenantId: string, fileHash: string): Promise<Document | null> {
    const rows = await this.db.query<Row>('SELECT * FROM document WHERE tenant_id = ? AND file_hash = ?', [
      tenantId,
      fileHash,
    ]);
    return rows[0] ? rowToDocument(rows[0]) : null;
  }
}
