/**
 * Bundles the rule config files (config/*.json) into the app at build time,
 * mirroring backend/src/config/loadConfig.ts's fs-based loader but via a
 * Vite JSON import instead of fs.readFileSync — same files, same shapes, just
 * a different I/O path per docs/v2-migration-spec.md's core principle.
 */
import categoryRulesJson from '../../../config/category-rules.json';
import merchantRulesJson from '../../../config/merchant-rules.json';
import salaryParserRulesJson from '../../../config/salary-parser-rules.json';
import statementParserRulesJson from '../../../config/statement-parser-rules.json';
import type { MerchantRulesConfig } from '@dollarmind/core/services/MerchantDetectionService.js';
import type { SalaryParserRules } from '@dollarmind/core/parsers/payslip/payslipParser.js';
import type { StatementParserRules } from '@dollarmind/core/parsers/bank/statementParser.js';

export interface CategoryRulesConfig {
  version: number;
  categories: string[];
  rules: { matchType: 'contains' | 'regex' | 'merchant' | 'amount_range'; pattern: string; category: string; priority?: number }[];
}

export function loadCategoryRules(): CategoryRulesConfig {
  return categoryRulesJson as CategoryRulesConfig;
}

export function loadMerchantRules(): MerchantRulesConfig {
  return merchantRulesJson as MerchantRulesConfig;
}

export function loadSalaryParserRules(): SalaryParserRules {
  return salaryParserRulesJson as unknown as SalaryParserRules;
}

export function loadStatementParserRules(): StatementParserRules {
  return statementParserRulesJson as unknown as StatementParserRules;
}
