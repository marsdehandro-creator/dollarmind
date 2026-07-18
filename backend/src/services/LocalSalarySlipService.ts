/**
 * LocalSalarySlipService — pilot implementation of the SalarySlipService port.
 *
 * Storage-agnostic: depends only on repository ports + the pure parser. Writes
 * the raw file to local disk for provenance (docs/architecture.md §4, §5).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type {
  ParsedSlip,
  SalarySlipService,
  SlipWithComponents,
  UploadResult,
  UploadedFile,
} from './interfaces/SalarySlipService.js';
import type { AuditService } from './interfaces/AuditService.js';
import type { AccountRepository } from '../repositories/AccountRepository.js';
import type { DocumentRepository } from '../repositories/DocumentRepository.js';
import type { SalarySlipRepository } from '../repositories/SalarySlipRepository.js';
import type { SalaryComponentRepository } from '../repositories/SalaryComponentRepository.js';
import type { IssueRepository } from '../repositories/IssueRepository.js';
import type { Document, IssueLog, SalaryComponent, SalarySlip } from '../models/index.js';
import type { ParseResult, RawPayslip } from '../parsers/types.js';
import { parsePayslipText, type SalaryParserRules } from '../parsers/payslip/payslipParser.js';
import { extractDocumentText } from '../ingestion/extract.js';
import { Diagnostics } from '../ingestion/diagnostics.js';
import { ingestError } from '../utils/ingestErrors.js';
import { loadSalaryParserRules } from '../config/index.js';
import { newId, nowIso } from '../utils/id.js';

const PARSER_ID = 'text-payslip-v1';
const DEFAULT_EMPLOYER = 'My Employer';
const UPLOAD_DIR = resolve(process.cwd(), 'uploads', 'salary-slips');

export interface SalaryServiceDeps {
  accounts: AccountRepository;
  documents: DocumentRepository;
  slips: SalarySlipRepository;
  components: SalaryComponentRepository;
  issues: IssueRepository;
  audit: AuditService;
}

export class LocalSalarySlipService implements SalarySlipService {
  private readonly rules: SalaryParserRules;

  constructor(private readonly deps: SalaryServiceDeps) {
    this.rules = loadSalaryParserRules<SalaryParserRules>();
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  parseSlip(rawText: string): ParseResult<RawPayslip> {
    return parsePayslipText(rawText, this.rules);
  }

  async uploadSlip(input: { tenantId: string; file: UploadedFile }): Promise<UploadResult> {
    const { tenantId, file } = input;
    const now = nowIso();
    const diag = new Diagnostics('salary');

    // 1. Extract text (TXT/PDF/OCR) — business errors thrown for scanned/unsupported.
    const extraction = await extractDocumentText(
      { bytes: file.buffer, fileName: file.originalName, mimeType: file.mimeType },
      diag,
    );
    diag.record('normalize');

    // 2. Parse + validate mandatory fields.
    const parsed = this.parseSlip(extraction.text);
    const data = parsed.data;
    diag.record('detectFormat', { employer: data?.employer, source: extraction.source });
    if (!data || (data.grossAmount === undefined && data.netAmount === undefined)) {
      throw ingestError('MISSING_FIELDS', {
        message: 'Neither gross nor net pay could be read from this payslip.',
        suggestion: 'Upload a clearer payslip export, or check it contains gross/net pay.',
      });
    }
    diag.record('parse', { gross: data.grossAmount, net: data.netAmount, components: data.components.length });

    // 3. Store the raw file + record provenance (account named after the employer).
    const account = await this.deps.accounts.getOrCreateIncomeSource(tenantId, data.employer || DEFAULT_EMPLOYER);
    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    const safeName = file.originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const docId = newId();
    const storedPath = join(UPLOAD_DIR, `${docId}-${safeName}`);
    writeFileSync(storedPath, file.buffer);

    const document: Document = {
      id: docId,
      tenantId,
      accountId: account.id,
      docType: 'payslip',
      filePath: storedPath,
      fileHash,
      mimeType: file.mimeType,
      byteSize: file.size,
      parserId: `payslip-${extraction.source}-v2`,
      parseStatus: 'ok',
      parseMeta: null,
      uploadedAt: now,
      archivedAt: null,
    };
    await this.deps.documents.create(document);

    // 4. Persist slip + components (draft).
    const saved = await this.saveSlip(tenantId, {
      accountId: account.id,
      sourceDocumentId: document.id,
      periodStart: data?.periodStart ?? now.slice(0, 10),
      periodEnd: data?.periodEnd ?? now.slice(0, 10),
      grossAmount: data?.grossAmount ?? 0,
      netAmount: data?.netAmount ?? 0,
      currency: 'ZAR',
      employerName: data?.employer ?? null,
      employeeName: data?.employee ?? null,
      periodLabel: data?.periodLabel ?? null,
      notes: data?.notes ?? null,
      payDate: data?.payDate ?? null,
      components: (data?.components ?? []).map((c) => ({
        componentType: c.componentType,
        section: c.section,
        code: null,
        label: c.label,
        amount: c.amount,
        isTaxable: null,
        confidence: c.confidence,
      })),
    });

    const status = parsed.status;
    const warnings = [...extraction.warnings, ...parsed.warnings.map((w) => w.message)];
    await this.deps.documents.updateParseStatus(document.id, status, { confidence: parsed.confidence, warnings, source: extraction.source });
    diag.record('validate', { status, warnings: warnings.length });

    // 5. Log parsing issues.
    const issues = await this.logIssues(tenantId, saved.slip, status, warnings);

    await this.deps.audit.record({
      tenantId,
      actor: `user:${tenantId}`,
      action: 'salary.slip.uploaded',
      entityType: 'salary_slip',
      entityId: saved.slip.id,
      context: { parseStatus: status, confidence: parsed.confidence, source: extraction.source },
    });

    return {
      ...saved,
      issues,
      parseStatus: status,
      confidence: parsed.confidence,
      warnings,
      source: extraction.source,
      employer: data.employer ?? null,
      diagnostics: diag.summary(),
    };
  }

  async saveSlip(tenantId: string, parsed: ParsedSlip): Promise<SlipWithComponents> {
    const now = nowIso();
    const slip: SalarySlip = {
      id: newId(),
      tenantId,
      accountId: parsed.accountId,
      sourceDocumentId: parsed.sourceDocumentId,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      payDate: parsed.payDate ?? null,
      grossAmount: parsed.grossAmount,
      netAmount: parsed.netAmount,
      currency: parsed.currency,
      employerName: parsed.employerName ?? null,
      employeeName: parsed.employeeName ?? null,
      periodLabel: parsed.periodLabel ?? null,
      notes: parsed.notes ?? null,
      confirmed: false,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    await this.deps.slips.create(slip);

    const components: SalaryComponent[] = parsed.components.map((c, i) => ({
      id: newId(),
      tenantId,
      salarySlipId: slip.id,
      componentType: c.componentType,
      section: c.section,
      code: c.code,
      label: c.label,
      amount: c.amount,
      isTaxable: c.isTaxable,
      confidence: c.confidence,
      displayOrder: i,
      createdAt: now,
      updatedAt: now,
    }));
    await this.deps.components.createMany(components);

    return { slip, components };
  }

  async getSlipHistory(tenantId: string): Promise<SlipWithComponents[]> {
    const slips = await this.deps.slips.listByTenant(tenantId);
    const result: SlipWithComponents[] = [];
    for (const slip of slips) {
      result.push({ slip, components: await this.deps.components.listBySlip(slip.id) });
    }
    return result;
  }

  private async logIssues(
    tenantId: string,
    slip: SalarySlip,
    status: ParseResult<RawPayslip>['status'],
    messages: string[],
  ): Promise<IssueLog[]> {
    const issues: IssueLog[] = [];
    const push = (kind: string, severity: IssueLog['severity'], detail: unknown) => {
      const now = nowIso();
      issues.push({
        id: newId(),
        tenantId,
        source: 'system',
        kind,
        severity,
        entityType: 'salary_slip',
        entityId: slip.id,
        status: 'open',
        detail,
        createdAt: now,
        updatedAt: now,
        resolvedAt: null,
      });
    };

    if (status === 'failed') push('parse_fail', 'error', { messages });
    else if (status === 'partial') push('partial_parse', 'warning', { messages });

    // Light reconciliation check (docs/data-model.md §4.1).
    if (slip.grossAmount > 0 && slip.netAmount > slip.grossAmount) {
      push('slip_mismatch', 'warning', {
        message: 'Net pay exceeds gross pay — please review.',
        gross: slip.grossAmount,
        net: slip.netAmount,
      });
    }

    for (const issue of issues) await this.deps.issues.create(issue);
    return issues;
  }
}
