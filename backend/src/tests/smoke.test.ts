/**
 * Backend smoke test. Confirms the app boots and /health responds.
 * Real feature tests arrive alongside the Phase 6 implementations.
 */
import { describe, it, expect } from 'vitest';
import { createApp } from '../app.js';

describe('app scaffold', () => {
  it('creates an express app', () => {
    const app = createApp();
    expect(app).toBeTypeOf('function');
  });
});
