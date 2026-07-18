/**
 * Salary slip API client. Mirrors the backend SalarySlipService responses.
 */
import { apiGet, apiUpload } from './apiClient.js';

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

export function uploadSlip(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  return apiUpload<UploadResult>('/salary/upload', form);
}

export function getHistory(): Promise<{ slips: SlipWithComponents[] }> {
  return apiGet<{ slips: SlipWithComponents[] }>('/salary/history');
}
