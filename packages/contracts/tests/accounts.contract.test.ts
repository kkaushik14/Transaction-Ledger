/** Verifies browser-safe account contracts, including strict fields and exact money strings. */
import { describe, expect, it } from 'vitest';
import {
  accountIdParamsSchema,
  createAccountRequestSchema,
  createAccountResponseSchema,
  accountBalanceResponseSchema,
  apiErrorResponseSchema,
  balanceSchema,
} from '../src/index.js';

const id = '64c7dc4e-509c-460b-9175-c79503c4f4c5';
describe('account contracts', () => {
  it('normalizes a valid name and retains case', () => {
    expect(createAccountRequestSchema.parse({ name: '  Alex Morgan  ' })).toEqual({
      name: 'Alex Morgan',
    });
  });
  it.each(['', '   ', '\t\n', 'a'.repeat(121), 'bad\0name'])('rejects an invalid name', (name) => {
    expect(createAccountRequestSchema.safeParse({ name }).success).toBe(false);
  });
  it('counts Unicode characters consistently with PostgreSQL', () => {
    expect(createAccountRequestSchema.safeParse({ name: '😀'.repeat(120) }).success).toBe(true);
    expect(createAccountRequestSchema.safeParse({ name: '😀'.repeat(121) }).success).toBe(false);
  });
  it.each(['balance', 'id', 'created_at', 'account_id', 'other'])(
    'rejects extra field %s',
    (key) => {
      expect(
        createAccountRequestSchema.safeParse({ name: 'Alex', [key]: 'untrusted' }).success,
      ).toBe(false);
    },
  );
  it.each([0, 1.5, '-1.00', '1', '1.5', '1e2', 'NaN', '1000000000000000000.00'])(
    'rejects an invalid balance',
    (balance) => {
      expect(balanceSchema.safeParse(balance).success).toBe(false);
    },
  );
  it('accepts normalized decimal strings including the NUMERIC(20,2) maximum', () => {
    expect(balanceSchema.parse('0.00')).toBe('0.00');
    expect(balanceSchema.parse('999999999999999999.99')).toBe('999999999999999999.99');
  });
  it('validates UUID params and both success envelopes', () => {
    expect(accountIdParamsSchema.parse({ accountId: id })).toEqual({ accountId: id });
    expect(accountIdParamsSchema.safeParse({ accountId: 'invalid' }).success).toBe(false);
    expect(
      createAccountResponseSchema.safeParse({
        data: { id, name: 'Alex', balance: '0.00', created_at: '2026-10-28T00:00:00.000Z' },
      }).success,
    ).toBe(true);
    expect(
      accountBalanceResponseSchema.parse({ data: { account_id: id, balance: '0.00' } }).data
        .balance,
    ).toBe('0.00');
  });
  it('accepts the standard error response and rejects unknown codes', () => {
    expect(
      apiErrorResponseSchema.safeParse({
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: 'Account not found',
          support_ticket_id: '11111111-1111-4111-8111-111111111111',
          action: 'fix_input',
        },
      }).success,
    ).toBe(true);
    expect(
      apiErrorResponseSchema.safeParse({
        error: {
          code: 'raw-db-code',
          message: 'oops',
          support_ticket_id: '11111111-1111-4111-8111-111111111111',
          action: 'fix_input',
        },
      }).success,
    ).toBe(false);
  });
});
