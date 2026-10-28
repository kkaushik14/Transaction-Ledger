/** Transfer command validation and correlated response checks preserve exact money and reference identity. */
import { describe, expect, it } from 'vitest';
import { createTransferRequestSchema, createTransferResponseSchema } from '../src/index.js';
const source = 'aaaaaaaa-0000-4000-8000-000000000001';
const destination = 'bbbbbbbb-0000-4000-8000-000000000002';
const id = 'cccccccc-0000-4000-8000-000000000003';
const valid = {
  source_account_id: source,
  destination_account_id: destination,
  amount: '1.50',
  reference_id: ' Ref-1 ',
};
const transfer = { ...valid, id, description: '', created_at: '2026-10-28T00:00:00.000Z' };
const leg = {
  amount: '1.50',
  reference_id: valid.reference_id,
  description: '',
  transfer_id: id,
  created_at: transfer.created_at,
};
const response = {
  data: {
    transfer,
    debit: {
      ...leg,
      id: 'dddddddd-0000-4000-8000-000000000004',
      account_id: source,
      type: 'debit',
    },
    credit: {
      ...leg,
      id: 'eeeeeeee-0000-4000-8000-000000000005',
      account_id: destination,
      type: 'credit',
    },
    source_account_balance: '0.00',
    destination_account_balance: '1.50',
  },
};

describe('transfer contracts', () => {
  it('normalizes money and UUID casing, defaults description, and preserves reference identity', () => {
    expect(
      createTransferRequestSchema.parse({
        ...valid,
        source_account_id: source.toUpperCase(),
        amount: '1.5',
      }),
    ).toEqual({ ...valid, description: '' });
  });
  it.each([
    '0',
    '0.00',
    '-1',
    '+1',
    '01',
    ' 1',
    '1 ',
    '1e2',
    '1.001',
    '1000000000000000000',
    1,
    null,
  ])('rejects invalid amount %j', (amount) => {
    expect(createTransferRequestSchema.safeParse({ ...valid, amount }).success).toBe(false);
  });
  it.each([
    { source_account_id: 'bad' },
    { destination_account_id: 'bad' },
    { source_account_id: null },
    { destination_account_id: undefined },
    { destination_account_id: source },
    { destination_account_id: source.toUpperCase() },
    { reference_id: '' },
    { reference_id: ' \t ' },
    { reference_id: 'x'.repeat(129) },
    { reference_id: 'bad\0ref' },
    { description: 'x'.repeat(501) },
    { description: null },
    { description: 'bad\0description' },
    { id },
    { transfer_id: id },
    { type: 'credit' },
    { account_id: source },
    { source_account_balance: '1.00' },
    { created_at: transfer.created_at },
  ])('rejects invalid or server-owned fields %j', (fields) => {
    expect(createTransferRequestSchema.safeParse({ ...valid, ...fields }).success).toBe(false);
  });
  it('accepts maximum precision and Unicode limits without converting money to numbers', () => {
    const input = {
      ...valid,
      amount: '999999999999999999.99',
      reference_id: '😀'.repeat(128),
      description: '😀'.repeat(500),
    };
    expect(createTransferRequestSchema.parse(input)).toEqual(input);
  });
  it('accepts a normalized response with a correlated debit and credit', () => {
    expect(createTransferResponseSchema.parse(response)).toEqual(response);
  });
  it.each([
    { type: 'credit' },
    { transfer_id: source },
    { account_id: destination },
    { amount: '1.51' },
    { reference_id: 'other' },
    { description: 'other' },
    { id: response.data.credit.id },
    { amount: '1.5' },
  ])('rejects a mismatched debit response %j', (fields) => {
    expect(
      createTransferResponseSchema.safeParse({
        data: { ...response.data, debit: { ...response.data.debit, ...fields } },
      }).success,
    ).toBe(false);
  });
});
