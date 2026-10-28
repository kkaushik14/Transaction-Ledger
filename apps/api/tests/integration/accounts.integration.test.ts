/**
 * HTTP-to-SQL account tests run against an isolated, disposable PGlite database.
 * Applies the real migration; never reads .env or accesses the hosted ledger.
 */
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { Express } from 'express';
import type { QueryResultRow } from 'pg';
import request from 'supertest';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import {
  createAccountResponseSchema,
  accountBalanceResponseSchema,
  apiErrorResponseSchema,
} from '@ledger/contracts';
import { createApp } from '../../src/index.js';
import type { AccountDatabase } from '../../src/modules/accounts/index.js';

let database: PGlite;
let app: Express;
beforeAll(async () => {
  database = new PGlite();
  await database.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  await database.exec(
    await readFile(
      new URL('../../../../supabase/migrations/20261028000000_create_ledger.sql', import.meta.url),
      'utf8',
    ),
  );
  const executor: AccountDatabase = {
    query: <Row extends QueryResultRow>(sql: string, values: unknown[]) =>
      database.query<Row>(sql, values),
  };
  app = createApp({
    database: {
      ...executor,
      connect: async () => {
        throw new Error('Account tests must not acquire a transaction client');
      },
    },
    webOrigin: 'http://localhost:5173',
  });
}, 30000);
beforeEach(async () => {
  await database.exec('TRUNCATE ledger.transactions, ledger.accounts');
});
afterAll(async () => {
  await database?.close();
});

/** Returns row count only from this test's disposable database. */
async function accountCount(): Promise<number> {
  const result = await database.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM ledger.accounts',
  );
  return result.rows[0]?.count ?? -1;
}

describe('account HTTP API', () => {
  it('creates a trimmed account with zero balance and system identity/time, then reads its balance', async () => {
    const created = await request(app)
      .post('/api/v1/accounts')
      .send({ name: '  Alex Morgan  ' })
      .expect(201);
    const account = createAccountResponseSchema.parse(created.body).data;
    expect(account.name).toBe('Alex Morgan');
    expect(account.balance).toBe('0.00');
    expect(Number.isNaN(Date.parse(account.created_at))).toBe(false);
    const result = await request(app).get(`/api/v1/accounts/${account.id}/balance`).expect(200);
    expect(accountBalanceResponseSchema.parse(result.body).data).toEqual({
      account_id: account.id,
      balance: '0.00',
    });
    expect(await accountCount()).toBe(1);
    expect((await database.query('SELECT * FROM ledger.transactions')).rows).toHaveLength(0);
  });
  it('allows duplicate names while generating distinct account IDs', async () => {
    const first = await request(app).post('/api/v1/accounts').send({ name: 'Alex' }).expect(201);
    const second = await request(app).post('/api/v1/accounts').send({ name: 'Alex' }).expect(201);
    expect(first.body.data.id).not.toBe(second.body.data.id);
    expect(await accountCount()).toBe(2);
  });
  it('persists Unicode names at the 120-character boundary', async () => {
    await request(app)
      .post('/api/v1/accounts')
      .send({ name: '😀'.repeat(120) })
      .expect(201);
    await request(app)
      .post('/api/v1/accounts')
      .send({ name: '😀'.repeat(121) })
      .expect(400);
    expect(await accountCount()).toBe(1);
  });
  it.each([
    {},
    { name: '' },
    { name: ' \t\n ' },
    { name: 123 },
    { name: null },
    null,
    [],
    { name: 'a'.repeat(121) },
    { name: 'bad\0name' },
    { name: 'Alex', balance: '99.00' },
    { name: 'Alex', id: '64c7dc4e-509c-460b-9175-c79503c4f4c5' },
    { name: 'Alex', created_at: '2026-01-01T00:00:00.000Z' },
    { name: 'Alex', unknown: true },
  ])('rejects invalid or server-owned input without an insert: %j', async (body) => {
    const result = await request(app)
      .post('/api/v1/accounts')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(body))
      .expect(400);
    expect(apiErrorResponseSchema.parse(result.body).error.code).toBe('VALIDATION_ERROR');
    expect(await accountCount()).toBe(0);
  });
  it('handles missing/malformed JSON and unsupported media consistently', async () => {
    const missing = await request(app)
      .post('/api/v1/accounts')
      .set('Content-Type', 'application/json')
      .expect(400);
    const malformed = await request(app)
      .post('/api/v1/accounts')
      .set('Content-Type', 'application/json')
      .send('{"name":')
      .expect(400);
    const unsupported = await request(app)
      .post('/api/v1/accounts')
      .type('text')
      .send('name=Alex')
      .expect(415);
    for (const result of [missing, malformed, unsupported])
      expect(apiErrorResponseSchema.safeParse(result.body).success).toBe(true);
    expect(await accountCount()).toBe(0);
  });
  it('rejects oversized JSON before inserting', async () => {
    const result = await request(app)
      .post('/api/v1/accounts')
      .send({ name: 'a'.repeat(17000) })
      .expect(413);
    expect(result.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(await accountCount()).toBe(0);
  });
  it('returns 400 for invalid UUIDs and 404 for valid missing accounts', async () => {
    const invalid = await request(app).get('/api/v1/accounts/not-a-uuid/balance').expect(400);
    const missing = await request(app)
      .get('/api/v1/accounts/64c7dc4e-509c-460b-9175-c79503c4f4c5/balance')
      .expect(404);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    expect(apiErrorResponseSchema.parse(missing.body).error.code).toBe('ACCOUNT_NOT_FOUND');
  });
  it('returns a safe 400 for malformed URL parameter encoding', async () => {
    const result = await request(app).get('/api/v1/accounts/%ZZ/balance').expect(400);
    expect(apiErrorResponseSchema.parse(result.body).error.code).toBe('VALIDATION_ERROR');
  });
  it('uses parameter binding for names that resemble SQL', async () => {
    const name = "Alex'); DROP TABLE ledger.accounts; --";
    const result = await request(app).post('/api/v1/accounts').send({ name }).expect(201);
    expect(result.body.data.name).toBe(name);
    expect(await accountCount()).toBe(1);
  });
  it('returns a stored balance as a decimal string without floating-point conversion', async () => {
    // A fixture-only balance write in the disposable engine verifies serialization;
    // transaction behavior is verified separately without hosted data mutation.
    const id = '64c7dc4e-509c-460b-9175-c79503c4f4c5';
    await database.query('INSERT INTO ledger.accounts(id,name,balance) VALUES($1,$2,$3)', [
      id,
      'Precision',
      '999999999999999999.99',
    ]);
    const result = await request(app).get(`/api/v1/accounts/${id}/balance`).expect(200);
    expect(result.body.data.balance).toBe('999999999999999999.99');
  });
  it('handles CORS preflight and restricts browser access to the configured origin', async () => {
    const allowed = await request(app)
      .options('/api/v1/accounts')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const other = await request(app)
      .get('/missing')
      .set('Origin', 'https://other.example')
      .expect(404);
    expect(other.headers['access-control-allow-origin']).not.toBe('https://other.example');
    expect(await accountCount()).toBe(0);
  });
  it('keeps account mutation routes unimplemented', async () => {
    for (const method of ['put', 'patch', 'delete'] as const) {
      const path = '/api/v1/accounts/64c7dc4e-509c-460b-9175-c79503c4f4c5';
      const response = await request(app)
        [method](path)
        .send({ type: 'credit', amount: '1.00' })
        .expect(404);
      expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
    }
  });
  it('forwards async database failures as sanitized 500 responses and logs no secrets', async () => {
    const error = new Error('password=secret SELECT private_sql');
    const failing = createApp({
      database: {
        connect: async () => {
          throw new Error('Unused transaction connection');
        },
        query: async () => {
          throw error;
        },
      },
      webOrigin: 'http://localhost:5173',
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await request(failing)
        .post('/api/v1/accounts')
        .send({ name: 'Alex' })
        .expect(500);
      expect(apiErrorResponseSchema.parse(response.body).error).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: {},
      });
      expect(JSON.stringify(response.body)).not.toContain('secret');
      expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
    } finally {
      log.mockRestore();
    }
  });
  it('does not query the database for invalid input or invalid UUID', async () => {
    const query = vi.fn(async () => {
      throw new Error('Must not query');
    });
    const isolated = createApp({
      database: {
        query,
        connect: async () => {
          throw new Error('Unused transaction connection');
        },
      },
      webOrigin: 'http://localhost:5173',
    });
    await request(isolated)
      .post('/api/v1/accounts')
      .send({ name: 'Alex', balance: '1.00' })
      .expect(400);
    await request(isolated).get('/api/v1/accounts/invalid/balance').expect(400);
    expect(query).not.toHaveBeenCalled();
  });
});
