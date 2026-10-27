/** Covers strict transaction input, decimal precision, and preserved reference identity. */
import { describe, expect, it } from 'vitest';
import {
  createTransactionRequestSchema,
  transactionAmountSchema,
  createTransactionResponseSchema,
} from '../src/index.js';
const valid = { type: 'credit', amount: '1.50', reference_id: 'ref-1' };
describe('transaction contracts', () => {
  it.each([
    ['1', '1.00'],
    ['1.5', '1.50'],
    ['0.01', '0.01'],
    ['999999999999999999.99', '999999999999999999.99'],
  ])('normalizes %s to %s exactly', (input, output) => {
    expect(transactionAmountSchema.parse(input)).toBe(output);
  });
  it.each([
    '0',
    '0.0',
    '0.00',
    '-1',
    '+1',
    '1e2',
    '1.234',
    '01',
    ' 1',
    '1 ',
    '1.',
    'NaN',
    'Infinity',
    '1000000000000000000',
    1,
    1.5,
    null,
  ])('rejects invalid amount %j', (amount) => {
    expect(createTransactionRequestSchema.safeParse({ ...valid, amount }).success).toBe(false);
  });
  it('defaults description and preserves reference whitespace and case', () => {
    expect(createTransactionRequestSchema.parse({ ...valid, reference_id: ' Ref-1 ' })).toEqual({
      ...valid,
      reference_id: ' Ref-1 ',
      description: '',
    });
  });
  it.each([
    { type: 'Credit' },
    { type: 'transfer' },
    { reference_id: '' },
    { reference_id: ' \t ' },
    { reference_id: 'x'.repeat(129) },
    { reference_id: 'bad\0ref' },
    { description: 'x'.repeat(501) },
    { description: null },
    { description: 'bad\0note' },
    { id: 'chosen' },
    { account_id: 'chosen' },
    { created_at: 'chosen' },
    { balance: '999.00' },
  ])('rejects invalid and server-owned input %j', (fields) => {
    expect(createTransactionRequestSchema.safeParse({ ...valid, ...fields }).success).toBe(false);
  });
  it('counts description and reference Unicode code points', () => {
    expect(
      createTransactionRequestSchema.safeParse({
        ...valid,
        reference_id: '😀'.repeat(128),
        description: '😀'.repeat(500),
      }).success,
    ).toBe(true);
  });
  it('validates the documented normalized response', () => {
    const id = '64c7dc4e-509c-460b-9175-c79503c4f4c5';
    expect(
      createTransactionResponseSchema.safeParse({
        data: {
          transaction: {
            ...valid,
            description: '',
            id,
            account_id: id,
            created_at: '2026-10-28T00:00:00.000Z',
          },
          account_balance: '1.50',
        },
      }).success,
    ).toBe(true);
  });
});
