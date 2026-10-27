/** Verifies history query defaults, strict URL syntax, safe offsets, and response metadata. */
import { describe, expect, it } from 'vitest';
import { transactionHistoryQuerySchema, transactionHistoryResponseSchema } from '../src/index.js';

describe('history contracts', () => {
  it('defaults to page 1, limit 20, and both transaction types', () => {
    expect(transactionHistoryQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });
  it('parses type and integer URL fields', () => {
    expect(transactionHistoryQuerySchema.parse({ type: 'debit', page: '2', limit: '100' })).toEqual(
      { type: 'debit', page: 2, limit: 100 },
    );
  });
  it.each([
    { page: '' },
    { page: '0' },
    { page: '-1' },
    { page: '1.0' },
    { page: '1e2' },
    { page: ' 1' },
    { page: '01' },
    { page: '9007199254740992' },
    { page: '9007199254740991', limit: '100' },
    { limit: '' },
    { limit: '0' },
    { limit: '101' },
    { limit: '1.5' },
    { limit: '1e2' },
    { type: '' },
    { type: 'all' },
    { type: 'Credit' },
    { type: ['credit', 'debit'] },
    { page: ['1', '2'] },
    { page: { nested: '1' } },
    { unknown: 'value' },
  ])('rejects invalid query %j', (query) => {
    expect(transactionHistoryQuerySchema.safeParse(query).success).toBe(false);
  });
  it('permits a large safe out-of-range page without losing offset precision', () => {
    expect(transactionHistoryQuerySchema.parse({ page: '9007199254740991', limit: '1' }).page).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });
  it('accepts empty result metadata with zero total pages', () => {
    expect(
      transactionHistoryResponseSchema.safeParse({
        data: [],
        pagination: { page: 1, limit: 20, total_records: 0, total_pages: 0 },
      }).success,
    ).toBe(true);
  });
  it('rejects noninteger or invalid response metadata', () => {
    expect(
      transactionHistoryResponseSchema.safeParse({
        data: [],
        pagination: { page: 0, limit: 101, total_records: -1, total_pages: 0.5 },
      }).success,
    ).toBe(false);
  });
});
