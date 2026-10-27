/** History HTTP/SQL and concurrent-read tests on an isolated native PostgreSQL 17 cluster. */
import type { Express } from 'express';
import type { Pool } from 'pg';
import { setTimeout as pause } from 'node:timers/promises';
import request from 'supertest';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { transactionHistoryResponseSchema } from '@ledger/contracts';
import { createApp } from '../../src/app.js';
import { createTestPostgres } from '../helpers/test-postgres.js';

let fixture: Awaited<ReturnType<typeof createTestPostgres>>;
let pool: Pool;
let app: Express;
beforeAll(async () => {
  fixture = await createTestPostgres();
  pool = fixture.pool;
  app = createApp({ database: pool, webOrigin: 'http://localhost:5173' });
}, 60000);
beforeEach(async () => {
  await pool.query('TRUNCATE ledger.transactions,ledger.accounts');
});
afterAll(async () => {
  await fixture?.stop();
}, 30000);

/** Creates one local account and returns its database-generated UUID. */
async function account(): Promise<string> {
  const response = await request(app)
    .post('/api/v1/accounts')
    .send({ name: 'History test' })
    .expect(201);
  return response.body.data.id;
}
/** Seeds valid immutable entries through HTTP, retaining corresponding ledger IDs. */
async function seed(id: string): Promise<string[]> {
  const ids: string[] = [];
  for (const [type, amount, reference_id] of [
    ['credit', '100', 'credit-1'],
    ['debit', '10', 'debit-1'],
    ['credit', '2', 'credit-2'],
    ['debit', '5', 'debit-2'],
    ['credit', '3', 'credit-3'],
  ] as const) {
    const response = await request(app)
      .post(`/api/v1/accounts/${id}/transactions`)
      .send({ type, amount, reference_id })
      .expect(201);
    ids.push(response.body.data.transaction.id);
  }
  return ids;
}
/** Captures balance and row count so failed reads cannot silently mutate ledger state. */
async function state(id: string): Promise<unknown> {
  return (
    await pool.query(
      `SELECT balance::text AS balance,(SELECT count(*)::int FROM ledger.transactions WHERE account_id=$1) AS count FROM ledger.accounts WHERE id=$1`,
      [id],
    )
  ).rows;
}

describe('transaction history', () => {
  it('returns empty history and zero totals for an existing account', async () => {
    const id = await account();
    const response = await request(app).get(`/api/v1/accounts/${id}/transactions`).expect(200);
    expect(transactionHistoryResponseSchema.parse(response.body)).toEqual({
      data: [],
      pagination: { page: 1, limit: 20, total_records: 0, total_pages: 0 },
    });
  });
  it('returns both types by default, newest timestamp first and UUID descending on ties', async () => {
    const id = await account();
    const ids = await seed(id);
    // Control only timestamps in this disposable fixture, making sort/tie expectations deterministic.
    await pool.query(
      `UPDATE ledger.transactions SET created_at='2026-01-01T00:00:00Z' WHERE account_id=$1`,
      [id],
    );
    await pool.query(
      `UPDATE ledger.transactions SET created_at='2026-01-02T00:00:00Z' WHERE id=ANY($1::uuid[])`,
      [ids.slice(0, 2)],
    );
    const snapshot = await state(id);
    const response = await request(app).get(`/api/v1/accounts/${id}/transactions`).expect(200);
    const result = transactionHistoryResponseSchema.parse(response.body);
    expect(result.data.map((row) => row.id)).toEqual([
      ...ids.slice(0, 2).sort().reverse(),
      ...ids.slice(2).sort().reverse(),
    ]);
    expect(new Set(result.data.map((row) => row.type))).toEqual(new Set(['credit', 'debit']));
    expect(
      result.data.every((row) => typeof row.amount === 'string' && row.amount.endsWith('.00')),
    ).toBe(true);
    expect(result.pagination).toEqual({ page: 1, limit: 20, total_records: 5, total_pages: 1 });
    expect(await state(id)).toEqual(snapshot);
  });
  it.each([
    ['credit', 3],
    ['debit', 2],
  ] as const)('filters %s before counting and pagination', async (type, total) => {
    const id = await account();
    await seed(id);
    const foreign = await account();
    await seed(foreign);
    const first = await request(app)
      .get(`/api/v1/accounts/${id}/transactions?type=${type}&limit=1`)
      .expect(200);
    expect(first.body.data).toHaveLength(1);
    expect(first.body.data[0].type).toBe(type);
    expect(first.body.data[0].account_id).toBe(id);
    expect(first.body.pagination).toEqual({
      page: 1,
      limit: 1,
      total_records: total,
      total_pages: total,
    });
    const second = await request(app)
      .get(`/api/v1/accounts/${id}/transactions?type=${type}&limit=1&page=2`)
      .expect(200);
    expect(second.body.data).toHaveLength(1);
    expect(second.body.data[0].id).not.toBe(first.body.data[0].id);
    expect(second.body.data[0].type).toBe(type);
  });
  it('paginates without missing/duplicating rows and returns correct final/out-of-range pages', async () => {
    const id = await account();
    const ids = await seed(id);
    const found: string[] = [];
    for (const [page, length] of [
      [1, 2],
      [2, 2],
      [3, 1],
      [4, 0],
    ] as const) {
      const response = await request(app)
        .get(`/api/v1/accounts/${id}/transactions?page=${page}&limit=2`)
        .expect(200);
      expect(response.body.data).toHaveLength(length);
      expect(response.body.pagination).toEqual({
        page,
        limit: 2,
        total_records: 5,
        total_pages: 3,
      });
      found.push(...response.body.data.map((row: { id: string }) => row.id));
    }
    expect(found.sort()).toEqual(ids.sort());
  });
  it('returns empty data and zero totals when a valid filter matches nothing', async () => {
    const id = await account();
    await request(app)
      .post(`/api/v1/accounts/${id}/transactions`)
      .send({ type: 'credit', amount: '1.50', reference_id: 'credit' })
      .expect(201);
    const response = await request(app)
      .get(`/api/v1/accounts/${id}/transactions?type=debit&page=3&limit=10`)
      .expect(200);
    expect(response.body).toEqual({
      data: [],
      pagination: { page: 3, limit: 10, total_records: 0, total_pages: 0 },
    });
  });
  it('honors the default page size and maximum allowed limit', async () => {
    const id = await account();
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        request(app)
          .post(`/api/v1/accounts/${id}/transactions`)
          .send({ type: 'credit', amount: '0.01', reference_id: `default-${i}` })
          .expect(201),
      ),
    );
    const first = await request(app).get(`/api/v1/accounts/${id}/transactions`).expect(200);
    expect(first.body.data).toHaveLength(20);
    expect(first.body.pagination).toEqual({
      page: 1,
      limit: 20,
      total_records: 25,
      total_pages: 2,
    });
    const second = await request(app).get(`/api/v1/accounts/${id}/transactions?page=2`).expect(200);
    expect(second.body.data).toHaveLength(5);
    const maximum = await request(app)
      .get(`/api/v1/accounts/${id}/transactions?limit=100`)
      .expect(200);
    expect(maximum.body.data).toHaveLength(25);
    expect(maximum.body.pagination.limit).toBe(100);
  });
  it.each([
    'type=all',
    'type=Credit',
    'type=',
    'type=credit&type=debit',
    'page=0',
    'page=-1',
    'page=1.5',
    'page=1e2',
    'page=',
    'page=01',
    'page=1&page=2',
    'page[]=1',
    'page=9007199254740992',
    'page=9007199254740991&limit=100',
    'limit=0',
    'limit=101',
    'limit=-1',
    'limit=1.1',
    'limit=1e2',
    'limit=',
    'type=credit%27%20OR%201=1--',
    'unexpected=value',
  ])('rejects query %s before querying the database', async (query) => {
    const connect = vi.fn(async () => {
      throw new Error('Must not acquire a client');
    });
    const isolated = createApp({
      database: { query: pool.query.bind(pool), connect },
      webOrigin: 'http://localhost:5173',
    });
    const response = await request(isolated)
      .get(`/api/v1/accounts/64c7dc4e-509c-460b-9175-c79503c4f4c5/transactions?${query}`)
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(connect).not.toHaveBeenCalled();
  });
  it('validates UUIDs and distinguishes missing accounts from empty histories', async () => {
    await request(app).get('/api/v1/accounts/invalid/transactions').expect(400);
    const response = await request(app)
      .get('/api/v1/accounts/64c7dc4e-509c-460b-9175-c79503c4f4c5/transactions')
      .expect(404);
    expect(response.body.error.code).toBe('ACCOUNT_NOT_FOUND');
  });
  it('keeps pagination data and totals in the same snapshot during a concurrent write', async () => {
    const id = await account();
    await seed(id);
    const writer = await pool.connect();
    let pending: Promise<request.Response> | undefined;
    try {
      await writer.query('BEGIN');
      await writer.query('LOCK TABLE ledger.transactions IN ACCESS EXCLUSIVE MODE');
      pending = request(app)
        .get(`/api/v1/accounts/${id}/transactions`)
        .then((response) => response);
      // The reader establishes its snapshot at the account-existence SELECT, then
      // blocks on the table lock when counting. The writer commits after that point.
      let waiting = 0;
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const result = await pool.query<{
          count: number;
        }>(`SELECT count(*)::int AS count FROM pg_stat_activity
          WHERE application_name='ledger-isolated-tests' AND wait_event_type='Lock'
          AND query LIKE 'SELECT count(*)::text AS count FROM ledger.transactions%'`);
        waiting = result.rows[0]?.count ?? 0;
        if (waiting >= 1) break;
        await pause(10);
      }
      expect(waiting).toBeGreaterThanOrEqual(1);
      await writer.query('UPDATE ledger.accounts SET balance=balance+1 WHERE id=$1', [id]);
      await writer.query(
        `INSERT INTO ledger.transactions(account_id,type,amount,reference_id) VALUES($1,'credit',1,'concurrent')`,
        [id],
      );
      await writer.query('COMMIT');
      const response = await pending;
      expect(response.status).toBe(200);
      expect(response.body.pagination.total_records).toBe(5);
      expect(response.body.data).toHaveLength(5);
      expect(
        response.body.data.some(
          (row: { reference_id: string }) => row.reference_id === 'concurrent',
        ),
      ).toBe(false);
      const next = await request(app).get(`/api/v1/accounts/${id}/transactions`).expect(200);
      expect(next.body.pagination.total_records).toBe(6);
      expect(next.body.data).toHaveLength(6);
    } finally {
      await writer.query('ROLLBACK');
      writer.release();
      await pending?.catch(() => {});
    }
  });
});
