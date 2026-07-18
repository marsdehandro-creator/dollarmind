/**
 * LocalStatementImportService — pilot implementation of StatementImportService.
 *
 * Pipeline (docs/architecture.md §5-6):
 *   store file -> file-level dedup (file_hash) -> parse (CSV/Excel/PDF) ->
 *   normalize rows -> exact + fuzzy dedup -> persist new rows (clustering
 *   near-duplicates) -> log parse + dedup issues -> audit.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type {
  StatementDetail,
  StatementImportService,
  StatementSummary,
  StatementUploadResult,
} from './interfaces/StatementImportService.js';
import type { UploadedFile } from './interfaces/SalarySlipService.js';
import type { AuditService } from './interfaces/AuditService.js';
import type { DeduplicationService } from './interfaces/DeduplicationService.js';
import type { AccountRepository } from '../repositories/AccountRepository.js';
import type { DocumentRepository } from '../repositories/DocumentRepository.js';
import type { BankStatementRepository } from '../repositories/BankStatementRepository.js';
import type { TransactionRepository } from '../repositories/TransactionRepository.js';
import type { IssueRepository } from '../repositories/IssueRepository.js';
import type { MerchantCategorizationService } from './MerchantCategorizationService.js';
import type { BankStatement, Document, IssueLog, Transaction } from '../models/index.js';
import type { RawTransaction } from '../parsers/types.js';
import { parseStatementText, type StatementParserRules } from '../parsers/bank/statementParser.js';
import { extractDocumentText } from '../ingestion/extract.js';
import { Diagnostics } from '../ingestion/diagnostics.js';
import { ingestError } from '../utils/ingestErrors.js';
import { loadStatementParserRules } from '../config/index.js';
import { newId, nowIso } from '../utils/id.js';
import { sha256Hex } from '../utils/hash.js';
import { normalizeDescription } from '../utils/normalize.js';

const PARSER_ID = 'statement-csv-v1';
const DEFAULT_BANK = 'My Bank';
const UPLOAD_DIR = resolve(process.cwd(), 'uploads', 'statements');

export interface StatementServiceDeps {
  accounts: AccountRepository;
  documents: DocumentRepository;
  statements: BankStatementRepository;
  transactions: TransactionRepository;
  issues: IssueRepository;
  merchantCategorizer: MerchantCategorizationService;
  dedup: DeduplicationService;
  audit: AuditService;
}

export class LocalStatementImportService implements StatementImportService {
  private readonly rules: StatementParserRules;

  constructor(private readonly deps: StatementServiceDeps) {
    this.rules = loadStatementParserRules<StatementParserRules>();
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  async uploadStatement(input: { tenantId: string; file: UploadedFile }): Promise<StatementUploadResult> {
    const { tenantId, file } = input;
    const now = nowIso();
    const fileHash = sha256Hex(file.buffer);

    // 1. File-level dedup: identical file already imported -> no-op.
    const priorDoc = await this.deps.documents.findByHash(tenantId, fileHash);
    if (priorDoc) {
      return {
        statement: null,
        imported: 0,
        duplicatesSkipped: 0,
        possibleDuplicates: 0,
        parseStatus: 'ok',
        fileAlreadyImported: true,
        issues: [],
      };
    }

    // 2. Store the file + record provenance.
    const account = await this.deps.accounts.getOrCreateBankAccount(tenantId, DEFAULT_BANK);
    const safeName = file.originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const docId = newId();
    const storedPath = join(UPLOAD_DIR, `${docId}-${safeName}`);
    writeFileSync(storedPath, file.buffer);

    const document: Document = {
      id: docId,
      tenantId,
      accountId: account.id,
      docType: 'bank_statement',
      filePath: storedPath,
      fileHash,
      mimeType: file.mimeType,
      byteSize: file.size,
      parserId: PARSER_ID,
      parseStatus: 'ok',
      parseMeta: null,
      uploadedAt: now,
      archivedAt: null,
    };
    await this.deps.documents.create(document);

    // 3. Extract text (CSV/TXT/PDF/OCR) then parse. Business errors thrown here
    //    (unsupported format, scanned-without-OCR, dataset too large, etc.)
    //    propagate to the controller as HTTP status + JSON body.
    const diag = new Diagnostics('statement');
    const extracted = await extractDocumentText(
      { bytes: file.buffer, fileName: file.originalName, mimeType: file.mimeType },
      diag,
    );
    diag.record('normalize');
    const result = parseStatementText(extracted.text, this.rules);
    diag.record('detectFormat', { bank: result.bank, shape: result.shape, source: extracted.source });
    const rows = result.data ?? [];
    diag.record('parse', { rows: rows.length });

    // 4. Create the statement header (period from row dates).
    const dates = rows.map((r) => r.txnDate).sort();
    const statement: BankStatement = {
      id: newId(),
      tenantId,
      accountId: account.id,
      sourceDocumentId: document.id,
      periodStart: dates[0] ?? null,
      periodEnd: dates[dates.length - 1] ?? null,
      openingBalance: null,
      closingBalance: null,
      currency: 'ZAR',
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    await this.deps.statements.create(statement);

    // 5. Normalize + dedup + persist.
    const issues: IssueLog[] = [];
    let imported = 0;
    let duplicatesSkipped = 0;
    let possibleDuplicates = 0;

    // Load existing account transactions once; bucket by amount for fast lookup.
    const existing = await this.deps.transactions.listByAccount(tenantId, account.id);
    const byAmount = new Map<number, Transaction[]>();
    for (const t of existing) {
      const bucket = byAmount.get(t.amount) ?? [];
      bucket.push(t);
      byAmount.set(t.amount, bucket);
    }

    for (const raw of rows) {
      const txn = this.toTransaction(tenantId, account.id, statement, document.id, raw);
      // Smart merchant-based categorization: every row gets a category (flag if unsure).
      const cls = await this.deps.merchantCategorizer.classify(tenantId, txn);
      txn.categoryId = cls.categoryId || null;
      txn.categorySource = cls.source === 'user_override' ? 'manual' : cls.source === 'fallback' ? 'auto' : 'rule';
      txn.merchant = cls.merchant;
      txn.confidence = cls.confidence;
      txn.flagged = cls.flagged;

      const candidates = byAmount.get(txn.amount) ?? [];
      const verdict = this.deps.dedup.classify(txn, candidates);

      if (verdict.kind === 'exact_duplicate') {
        duplicatesSkipped++;
        continue;
      }

      if (verdict.kind === 'possible_duplicate') {
        possibleDuplicates++;
        const matched = candidates.find((c) => c.id === verdict.existingId)!;
        const groupId = matched.dedupGroupId ?? newId();
        if (!matched.dedupGroupId) {
          await this.deps.transactions.setDedupGroup(matched.id, groupId);
          matched.dedupGroupId = groupId;
        }
        txn.dedupGroupId = groupId;
        issues.push(
          await this.deps.issues.create(
            this.issue(tenantId, 'possible_duplicate', 'warning', txn.id, {
              matchedTransactionId: matched.id,
              similarity: verdict.similarity,
              description: txn.descriptionRaw,
            }),
          ),
        );
      }

      await this.deps.transactions.create(txn);
      imported++;
      candidates.push(txn);
      byAmount.set(txn.amount, candidates);
    }

    // 6. Parse-quality issues + document status.
    const parseStatus = result.status;
    await this.deps.documents.updateParseStatus(document.id, parseStatus, {
      bank: result.bank,
      shape: result.shape,
      source: extracted.source,
      confidence: result.confidence,
      warnings: [...extracted.warnings, ...result.warnings.map((w) => w.message)],
    });
    diag.record('validate', { parseStatus, imported, duplicatesSkipped, possibleDuplicates });
    if (parseStatus === 'partial') {
      issues.push(
        await this.deps.issues.create(
          this.issue(tenantId, 'partial_parse', 'warning', statement.id, {
            warnings: result.warnings.map((w) => w.message),
          }),
        ),
      );
    }

    // Re-categorize previously flagged rows: a learned merchant rule may now match.
    let unflagged = 0;
    for (const t of await this.deps.transactions.listFlagged(tenantId)) {
      const cls = await this.deps.merchantCategorizer.classify(tenantId, t);
      if (!cls.flagged && cls.categoryId) {
        const src = cls.source === 'user_override' ? 'manual' : 'rule';
        await this.deps.transactions.updateCategory(t.id, cls.categoryId, src, false, cls.confidence);
        unflagged++;
      }
    }
    diag.record('reflag', { unflagged });

    await this.deps.audit.record({
      tenantId,
      actor: `user:${tenantId}`,
      action: 'statement.imported',
      entityType: 'bank_statement',
      entityId: statement.id,
      context: { imported, duplicatesSkipped, possibleDuplicates, parseStatus },
    });

    return {
      statement,
      imported,
      duplicatesSkipped,
      possibleDuplicates,
      parseStatus,
      fileAlreadyImported: false,
      issues,
      bank: result.bank,
      source: extracted.source,
      warnings: [...extracted.warnings, ...result.warnings.map((w) => w.message)],
      diagnostics: diag.summary(),
    };
  }

  async getStatementHistory(tenantId: string): Promise<StatementSummary[]> {
    const statements = await this.deps.statements.listByTenant(tenantId);
    const summaries: StatementSummary[] = [];
    for (const statement of statements) {
      summaries.push({ statement, transactionCount: await this.deps.transactions.countByStatement(statement.id) });
    }
    return summaries;
  }

  async getStatementDetail(tenantId: string, statementId: string): Promise<StatementDetail> {
    const statement = await this.deps.statements.findById(statementId);
    if (!statement || statement.tenantId !== tenantId) throw ingestError('VALIDATION_FAILED', { message: 'Statement not found.' });
    const transactions = await this.deps.transactions.listByStatement(statementId);
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      if (t.direction === 'credit') income += t.amount;
      else expense += t.amount;
    }
    return { statement, transactions, totals: { income, expense, count: transactions.length } };
  }

  private toTransaction(
    tenantId: string,
    accountId: string,
    statement: BankStatement,
    documentId: string,
    raw: RawTransaction,
  ): Transaction {
    const now = nowIso();
    const descriptionNorm = normalizeDescription(raw.description);
    const base = {
      accountId,
      txnDate: raw.txnDate,
      amount: raw.amount,
      direction: raw.direction,
      descriptionNorm,
    };
    return {
      id: newId(),
      tenantId,
      accountId,
      bankStatementId: statement.id,
      sourceDocumentId: documentId,
      sourceRow: raw.sourceRow ?? null,
      txnDate: raw.txnDate,
      descriptionRaw: raw.description,
      descriptionNorm,
      amount: raw.amount,
      direction: raw.direction,
      balanceAfter: raw.balanceAfter ?? null,
      currency: 'ZAR',
      categoryId: null,
      categorySource: 'default',
      merchant: null,
      confidence: 1,
      flagged: false,
      dedupGroupId: null,
      dedupHash: this.deps.dedup.computeHash(base),
      reconciledExpenseId: null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
  }

  private issue(
    tenantId: string,
    kind: string,
    severity: IssueLog['severity'],
    entityId: string,
    detail: unknown,
  ): IssueLog {
    const now = nowIso();
    return {
      id: newId(),
      tenantId,
      source: 'system',
      kind,
      severity,
      entityType: kind === 'possible_duplicate' ? 'transaction' : 'bank_statement',
      entityId,
      status: 'open',
      detail,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    };
  }
}
