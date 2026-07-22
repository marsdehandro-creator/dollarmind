/**
 * Salary slip local data access. Calls the on-device salarySlipService
 * directly — same shapes the backend's SalarySlipService used to return.
 */
import { getContainer } from '../local/container.js';

export type SalaryComponentType = 'earning' | 'deduction' | 'contribution' | 'allowance' | 'tax';

export interface SalarySlip {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string | null;
  grossAmount: number; // cents
  netAmount: number; // cents
  currency: string;
  employerName: string | null;
  employeeName: string | null;
  periodLabel: string | null;
  notes: string | null;
  confirmed: boolean;
  createdAt: string;
}

export interface SalaryComponent {
  id: string;
  componentType: SalaryComponentType;
  section: string | null;
  label: string;
  amount: number; // cents
  confidence: number;
  displayOrder: number;
}

export interface IssueLog {
  id: string;
  kind: string;
  severity: 'info' | 'warning' | 'error';
  detail: unknown;
}

export interface SlipWithComponents {
  slip: SalarySlip;
  components: SalaryComponent[];
}

export interface UploadResult extends SlipWithComponents {
  issues: IssueLog[];
  parseStatus: 'ok' | 'partial' | 'failed';
  confidence: number;
  warnings?: string[];
  source?: 'text' | 'pdf' | 'ocr';
  employer?: string | null;
  diagnostics?: string[];
}

export async function uploadSlip(file: File): Promise<UploadResult> {
  const { salarySlipService, tenantId } = await getContainer();
  const buffer = new Uint8Array(await file.arrayBuffer());
  const result = await salarySlipService.uploadSlip({
    tenantId,
    file: { buffer, originalName: file.name, mimeType: file.type || 'application/octet-stream', size: file.size },
  });
  return result as unknown as UploadResult;
}

export async function getHistory(): Promise<{ slips: SlipWithComponents[] }> {
  const { salarySlipService, tenantId } = await getContainer();
  const slips = await salarySlipService.getSlipHistory(tenantId);
  return { slips: slips as unknown as SlipWithComponents[] };
}
