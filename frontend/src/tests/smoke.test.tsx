/**
 * Frontend smoke test. Confirms money formatting behaves.
 * Component/render tests arrive with Phase 6.
 */
import { describe, it, expect } from 'vitest';
import { formatZar } from '../utils/money.js';

describe('money util', () => {
  it('formats cents as ZAR', () => {
    expect(formatZar(1234)).toBe('R12.34');
  });
});
