/** Public failure contracts enforce minimal, allowlisted and actionable error presentation. */
import { describe, expect, it } from 'vitest';
import {
  apiErrorResponseSchema,
  errorCodeSchema,
  errorActionSchema,
  publicFailureSchema,
  resolveErrorMessage,
  resolveActionLabel,
} from '../src/index.js';
const support_ticket_id = '11111111-1111-4111-8111-111111111111';
describe('public errors', () => {
  it.each(errorCodeSchema.options)(
    'maps %s exhaustively to safe actionable instructions',
    (code) => {
      const presentation = resolveErrorMessage(code);
      expect(publicFailureSchema.parse({ support_ticket_id, code, ...presentation })).toEqual({
        support_ticket_id,
        code,
        ...presentation,
      });
      expect(presentation.message).not.toMatch(/postgres|stack|password=|SELECT |node_modules/);
      expect(resolveActionLabel(presentation.action)).not.toBe('');
    },
  );
  it.each(errorActionSchema.options)('labels %s actions exhaustively', (action) =>
    expect(resolveActionLabel(action)).toBeTruthy(),
  );
  it('rejects extra technical details, missing IDs, unknown codes and executable recovery actions', () => {
    const error = {
      support_ticket_id,
      code: 'ACCOUNT_NOT_FOUND',
      ...resolveErrorMessage('ACCOUNT_NOT_FOUND'),
    };
    expect(apiErrorResponseSchema.safeParse({ error }).success).toBe(true);
    for (const change of [
      { details: {} },
      { stack: 'secret' },
      { support_ticket_id: '' },
      { code: '23505' },
      { action: 'javascript:alert(1)' },
    ])
      expect(apiErrorResponseSchema.safeParse({ error: { ...error, ...change } }).success).toBe(
        false,
      );
  });
  it('distinguishes uncertain financial writes and non-idempotent account creation from read retries', () => {
    expect(resolveErrorMessage('NETWORK_ERROR', 'transfer', true).message).toContain(
      'earlier request may already be recorded',
    );
    expect(resolveErrorMessage('INTERNAL_ERROR', 'account-create', true).action).toBe('go_back');
    expect(resolveActionLabel('retry', 'transaction', true)).toBe('Retry same request');
    expect(resolveErrorMessage('NETWORK_ERROR', 'history').message).toContain('History');
  });
});
