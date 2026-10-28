/** Typed domain mapping, support correlation and internal-cause preservation without any database calls. */
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { apiErrorResponseSchema, resolveErrorMessage } from '@ledger/contracts';
import {
  ApiError,
  AccountNotFoundError,
  BalanceLimitError,
  DuplicateReferenceError,
  InsufficientBalanceError,
  InputValidationError,
  serializeDiagnostic,
  type ErrorLogRecord,
} from '../../src/errors/index.js';
import { createErrorHandler } from '../../src/middleware/index.js';
import { createApp } from '../../src/index.js';
/** Produces one rejected asynchronous route so Express's real rejection/error middleware is exercised. */
function fixture(error: unknown, logger = vi.fn<(record: ErrorLogRecord) => void>()) {
  const app = express();
  app.get('/failure', async () => {
    throw error;
  });
  app.use(createErrorHandler(logger));
  return { app, logger };
}
describe('central HTTP errors', () => {
  it.each([
    [new AccountNotFoundError(), 404, 'ACCOUNT_NOT_FOUND'],
    [new DuplicateReferenceError('transaction'), 409, 'DUPLICATE_TRANSACTION'],
    [new DuplicateReferenceError('transfer'), 409, 'DUPLICATE_TRANSFER'],
    [new InsufficientBalanceError(), 422, 'INSUFFICIENT_BALANCE'],
    [new BalanceLimitError(), 422, 'BALANCE_LIMIT_EXCEEDED'],
    [new InputValidationError({ issues: ['internal-field-path'] }), 400, 'VALIDATION_ERROR'],
    [
      { code: '23505', constraint: 'transfers_source_reference_unique', message: 'private SQL' },
      409,
      'DUPLICATE_TRANSFER',
    ],
    [
      { code: '23505', constraint: 'transactions_account_reference_unique' },
      409,
      'DUPLICATE_TRANSACTION',
    ],
    [{ type: 'entity.parse.failed', body: 'secret' }, 400, 'VALIDATION_ERROR'],
    [{ type: 'entity.too.large' }, 413, 'PAYLOAD_TOO_LARGE'],
    [{ type: 'charset.unsupported' }, 415, 'UNSUPPORTED_MEDIA_TYPE'],
    [new Error('SELECT password=private'), 500, 'INTERNAL_ERROR'],
    ['raw private string', 500, 'INTERNAL_ERROR'],
    [{ code: '23505', constraint: 'unrecognized' }, 500, 'INTERNAL_ERROR'],
    [{ status: 401, code: 'ACCOUNT_NOT_FOUND' }, 500, 'INTERNAL_ERROR'],
  ] as const)('maps failure %# to %s with no technical payload', async (error, status, code) => {
    const { app, logger } = fixture(error);
    const response = await request(app).get('/failure').expect(status);
    const failure = apiErrorResponseSchema.parse(response.body).error;
    expect(Object.keys(failure).sort()).toEqual(['action', 'code', 'message', 'support_ticket_id']);
    expect(failure.code).toBe(code);
    expect(failure.message).toBe(resolveErrorMessage(code).message);
    expect(response.headers['x-support-ticket-id']).toBe(failure.support_ticket_id);
    expect(JSON.stringify(response.body)).not.toMatch(
      /SELECT|password=|private|internal-field-path|stack/,
    );
    expect(logger).toHaveBeenCalledTimes(1);
    const record = logger.mock.calls[0]![0];
    expect(record.supportTicketId).toBe(failure.support_ticket_id);
    expect(error instanceof ApiError ? record.error : (record.error as Error).cause).toBe(error);
  });
  it('ignores untrusted supplied messages and noncanonical statuses even on typed errors', async () => {
    const { app } = fixture(
      new ApiError(200, 'INSUFFICIENT_BALANCE', 'SELECT private_sql', { stack: 'secret' }),
    );
    const response = await request(app).get('/failure').expect(422);
    expect(response.body.error.message).toBe(resolveErrorMessage('INSUFFICIENT_BALANCE').message);
  });
  it('uses unique IDs for separate failures and ignores a caller-supplied support header', async () => {
    const { app } = fixture(new Error('failure'));
    const first = await request(app).get('/failure').set('X-Support-Ticket-ID', 'attacker');
    const second = await request(app).get('/failure');
    expect(first.body.error.support_ticket_id).not.toBe(second.body.error.support_ticket_id);
    expect(first.body.error.support_ticket_id).not.toBe('attacker');
  });
  it('still returns a safe response if an injected logging sink throws', async () => {
    const fallback = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { app } = fixture(
        new Error('request failed'),
        vi.fn(() => {
          throw new Error('sink failed');
        }),
      );
      const response = await request(app).get('/failure').expect(500);
      expect(apiErrorResponseSchema.safeParse(response.body).success).toBe(true);
      expect(fallback).toHaveBeenCalledTimes(1);
    } finally {
      fallback.mockRestore();
    }
  });
  it('serializes complete original causes and aggregate failures with redacted credentials and bounded cycles', () => {
    const original = new Error('password=hidden postgresql://user:secret@db/private');
    const rollback = new Error('rollback failed', { cause: original });
    const error = new AggregateError([original, rollback], 'transaction and rollback failed', {
      cause: original,
    });
    const encoded = JSON.stringify(serializeDiagnostic(error));
    expect(encoded).toContain('transaction and rollback failed');
    expect(encoded).toContain('rollback failed');
    expect(encoded).toContain('stack');
    expect(encoded).not.toContain('hidden');
    expect(encoded).not.toContain('user:secret');
    const circular = new Error('circular');
    circular.cause = circular;
    expect(JSON.stringify(serializeDiagnostic(circular))).toContain('circular error');
  });
});

describe('error handling audit', () => {
  it('keeps default serialized log correlation, timestamps and validation field paths intact', async () => {
    const lines: string[] = [];
    const { createErrorLogger } = await import('../../src/errors/index.js');
    const query = vi.fn(async () => ({ rows: [] }));
    const app = createApp({
      database: {
        query,
        connect: async () => {
          throw new Error('Unexpected connection');
        },
      },
      webOrigin: 'http://localhost:5173',
      logger: createErrorLogger((line) => lines.push(line)),
    });
    const response = await request(app).get('/api/v1/accounts/not-a-uuid/balance').expect(400);
    const record = JSON.parse(lines[0]!);
    expect(record.supportTicketId).toBe(response.body.error.support_ticket_id);
    expect(record.supportTicketId).toBe(response.headers['x-support-ticket-id']);
    expect(Number.isNaN(Date.parse(record.timestamp))).toBe(false);
    expect(record.error.details.issues[0]).toEqual({
      path: 'params.accountId',
      code: 'invalid_format',
    });
    expect(response.body.error).not.toHaveProperty('details');
    expect(record.scope).toBe('GET /api/v1/accounts/:accountId/balance');
    expect(query).not.toHaveBeenCalled();
  });
  it.each([
    'password="multiple word secret"',
    '{"password": "quoted secret value"}',
    "token='token with spaces'",
    'Authorization: Bearer abc.token.secret',
    'postgresql://user:credential@example.test/ledger',
  ])('redacts complete credentials inside diagnostic text: %#', (message) => {
    const serialized = JSON.stringify(serializeDiagnostic(new Error(message)));
    expect(serialized).not.toMatch(
      /multiple word|quoted secret value|token with spaces|abc\.token\.secret|user:credential/,
    );
    expect(serialized).toContain('[redacted');
  });
  it('omits request/query payloads and redacts nested credential fields while retaining useful causes', () => {
    const original = Object.assign(new Error('Original failed operation'), {
      body: { password: 'private-input' },
      query: 'SELECT private',
      details: { reason: 'validation', password: 'nested-credential' },
    });
    const serialized = JSON.stringify(
      serializeDiagnostic(new Error('Wrapped', { cause: original })),
    );
    expect(serialized).toContain('Original failed operation');
    expect(serialized).toContain('validation');
    expect(serialized).not.toMatch(/private-input|SELECT private|nested-credential/);
  });
  it.each(['object', 'function'])(
    'keeps revoked %s proxies from breaking the public error handler or logger',
    async (kind) => {
      const { proxy, revoke } = Proxy.revocable(kind === 'object' ? {} : () => {}, {});
      revoke();
      const lines: string[] = [];
      const { createErrorLogger } = await import('../../src/errors/index.js');
      const app = express();
      app.get('/failure', () => {
        throw proxy;
      });
      app.use(createErrorHandler(createErrorLogger((line) => lines.push(line))));
      const response = await request(app).get('/failure').expect(500);
      expect(apiErrorResponseSchema.safeParse(response.body).success).toBe(true);
      expect(JSON.parse(lines[0]!).supportTicketId).toBe(response.body.error.support_ticket_id);
      expect(JSON.stringify(response.body)).not.toMatch(/Proxy|stack|TypeError|node_modules/);
    },
  );
  it('does not coerce unknown parser metadata through a potentially throwing toString', async () => {
    const original = {
      type: {
        toString() {
          throw new Error('coercion failed');
        },
      },
    };
    const { app } = fixture(original);
    const response = await request(app).get('/failure').expect(500);
    expect(apiErrorResponseSchema.safeParse(response.body).success).toBe(true);
  });
});

describe('logging availability', () => {
  it('keeps the response safe and the support ID inspectable if both the configured sink and console fail', async () => {
    const { getLoggingFailures } = await import('../../src/errors/index.js');
    const original = new Error('original request failure');
    const consoleFailure = new Error('console unavailable');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {
      throw consoleFailure;
    });
    try {
      const { app } = fixture(
        original,
        vi.fn(() => {
          throw new Error('configured sink unavailable');
        }),
      );
      const response = await request(app).get('/failure').expect(500);
      expect(apiErrorResponseSchema.safeParse(response.body).success).toBe(true);
      const [fallback] = getLoggingFailures(response.body.error.support_ticket_id);
      expect(fallback?.loggingError).toBe(consoleFailure);
      expect((fallback?.record.error as AggregateError).errors[0].cause).toBe(original);
      expect(JSON.stringify(response.body)).not.toMatch(
        /console unavailable|configured sink|original request/,
      );
    } finally {
      spy.mockRestore();
    }
  });
});
