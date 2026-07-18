/**
 * Parser exports. Payslip and statement parsing operate on already-extracted
 * text (the ingestion layer handles CSV/TXT/PDF/OCR extraction upstream).
 */
export * from './types.js';
export { extractText, parsePayslipText } from './payslip/payslipParser.js';
export { parseStatementText, splitCsvLine, toIsoDate } from './bank/statementParser.js';
