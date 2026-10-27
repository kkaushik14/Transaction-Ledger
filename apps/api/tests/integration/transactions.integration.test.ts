/**
 * Credit/debit HTTP, rollback, and lock-contention tests on disposable real PostgreSQL 17.
 * Independent pg clients exercise actual MVCC and row locks; hosted data is never accessed.
 */
import type { Express } from 'express';
import type { Pool } from 'pg';
import { setTimeout as pause } from 'node:timers/promises';
import request from 'supertest';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { createTransactionResponseSchema } from '@ledger/contracts';
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

/** Creates an account through HTTP in the local disposable database. */
async function account(): Promise<string> {
  const result = await request(app)
    .post('/api/v1/accounts')
    .send({ name: 'Test account' })
    .expect(201);
  return result.body.data.id;
}
/** Submits one intended movement through the production HTTP implementation. */
function post(id: string, type: 'credit' | 'debit', amount: string, reference_id: string) {
  return request(app)
    .post(`/api/v1/accounts/${id}/transactions`)
    .send({ type, amount, reference_id });
}
/** Reads materialized balance and ledger count for precise failure assertions. */
async function state(id: string): Promise<{ balance: string; count: number }> {
  const result = await pool.query<{ balance: string; count: number }>(
    `SELECT a.balance::text AS balance,(SELECT count(*)::int FROM ledger.transactions t WHERE t.account_id=a.id) AS count
     FROM ledger.accounts a WHERE a.id=$1`,
    [id],
  );
  const value = result.rows[0];
  if (!value) throw new Error('Missing fixture account');
  return value;
}
/** Asserts stored balances match ledger sums after success, rejection, and concurrency. */
async function reconcile(): Promise<void> {
  const result =
    await pool.query(`SELECT a.id FROM ledger.accounts a LEFT JOIN ledger.transactions t ON t.account_id=a.id
    GROUP BY a.id HAVING a.balance<>COALESCE(SUM(CASE WHEN t.type='credit' THEN t.amount ELSE -t.amount END),0)`);
  expect(result.rows).toHaveLength(0);
}
/** Forces two actual sessions to wait on an account lock before letting competing requests proceed. */
async function contend(id: string, operations: () => Promise<number>[]): Promise<number[]> {
  const blocker = await pool.connect();
  let results: Promise<number>[] = [];
  try {
    await blocker.query('BEGIN');
    await blocker.query('SELECT id FROM ledger.accounts WHERE id=$1 FOR UPDATE', [id]);
    results = operations();
    const deadline = Date.now() + 5000;
    let waiting = 0;
    while (Date.now() < deadline) {
      const locks = await pool.query<{
        count: number;
      }>(`SELECT count(DISTINCT pid)::int AS count FROM pg_stat_activity
        WHERE application_name='ledger-isolated-tests' AND wait_event_type='Lock' AND query LIKE 'SELECT id FROM ledger.accounts%'`);
      waiting = locks.rows[0]?.count ?? 0;
      if (waiting >= 2) break;
      await pause(10);
    }
    expect(waiting).toBeGreaterThanOrEqual(2);
    await blocker.query('COMMIT');
    return await Promise.all(results);
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
    await Promise.allSettled(results);
  }
}

describe('credit/debit transactions', () => {
  it('applies +100 +50 -30 -20 exactly with immutable entry fields', async () => {
    const id = await account();
    for (const [type, amount, ref, balance] of [
      ['credit', '100', 'a', '100.00'],
      ['credit', '50', 'b', '150.00'],
      ['debit', '30', 'c', '120.00'],
      ['debit', '20', 'd', '100.00'],
    ] as const) {
      const response = await post(id, type, amount, ref).expect(201);
      const data = createTransactionResponseSchema.parse(response.body).data;
      expect(data.account_balance).toBe(balance);
      expect(data.transaction.account_id).toBe(id);
      expect(data.transaction.description).toBe('');
      expect(data.transaction.reference_id).toBe(ref);
    }
    expect(await state(id)).toEqual({ balance: '100.00', count: 4 });
    await reconcile();
  });
  it('allows an exact-balance debit, rejects overspending, and preserves money/count', async () => {
    const id = await account();
    await post(id, 'credit', '1.50', 'seed').expect(201);
    await post(id, 'debit', '1.51', 'too-much').expect(422);
    expect(await state(id)).toEqual({ balance: '1.50', count: 1 });
    await post(id, 'debit', '1.50', 'all').expect(201);
    const result = await post(id, 'debit', '0.01', 'empty').expect(422);
    expect(result.body.error.code).toBe('INSUFFICIENT_BALANCE');
    expect(await state(id)).toEqual({ balance: '0.00', count: 2 });
    await reconcile();
  });
  it('rejects duplicate references even for changed payloads and an exhausted balance', async () => {
    const id = await account();
    await post(id, 'credit', '1', 'seed').expect(201);
    await post(id, 'debit', '1', 'used').expect(201);
    for (const type of ['credit', 'debit'] as const) {
      const response = await post(id, type, '2', 'used').expect(409);
      expect(response.body.error.code).toBe('DUPLICATE_TRANSACTION');
    }
    expect(await state(id)).toEqual({ balance: '0.00', count: 2 });
    await reconcile();
  });
  it('scopes references per account and preserves case/whitespace identity', async () => {
    const a = await account(),
      b = await account();
    await post(a, 'credit', '1', 'ref').expect(201);
    await post(b, 'credit', '1', 'ref').expect(201);
    await post(a, 'credit', '1', 'REF').expect(201);
    await post(a, 'credit', '1', ' ref ').expect(201);
    expect(await state(a)).toEqual({ balance: '3.00', count: 3 });
    await reconcile();
  });
  it.each(['0', '-1', '1.001', '1e2', '1000000000000000000', 1])(
    'rejects amount %j before any writes',
    async (amount) => {
      const id = await account();
      await request(app)
        .post(`/api/v1/accounts/${id}/transactions`)
        .send({ type: 'credit', amount, reference_id: 'bad' })
        .expect(400);
      expect(await state(id)).toEqual({ balance: '0.00', count: 0 });
    },
  );
  it.each([
    { type: 'Credit' },
    { reference_id: '' },
    { reference_id: '  ' },
    { description: 'x'.repeat(501) },
    { id: 'chosen' },
    { account_id: 'chosen' },
    { created_at: 'chosen' },
    { balance: '5.00' },
    { unknown: true },
  ])('rejects invalid/extra fields %j', async (override) => {
    const id = await account();
    await request(app)
      .post(`/api/v1/accounts/${id}/transactions`)
      .send({ type: 'credit', amount: '1', reference_id: 'bad', ...override })
      .expect(400);
    expect(await state(id)).toEqual({ balance: '0.00', count: 0 });
  });
  it('validates UUIDs, missing accounts, body, and JSON media type', async () => {
    const id = await account();
    await post('invalid', 'credit', '1', 'ref').expect(400);
    await post('64c7dc4e-509c-460b-9175-c79503c4f4c5', 'credit', '1', 'ref').expect(404);
    await request(app)
      .post(`/api/v1/accounts/${id}/transactions`)
      .send({ type: 'credit', amount: '1' })
      .expect(400);
    await request(app)
      .post(`/api/v1/accounts/${id}/transactions`)
      .type('text')
      .send('credit')
      .expect(415);
    expect(await state(id)).toEqual({ balance: '0.00', count: 0 });
  });
  it('handles smallest units and maximum balance without JS precision loss or overflow', async () => {
    const id = await account();
    await post(id, 'credit', '999999999999999999.98', 'max').expect(201);
    await post(id, 'credit', '0.01', 'cent').expect(201);
    const result = await post(id, 'credit', '0.01', 'overflow').expect(422);
    expect(result.body.error.code).toBe('BALANCE_LIMIT_EXCEEDED');
    expect(await state(id)).toEqual({ balance: '999999999999999999.99', count: 2 });
    await post(id, 'debit', '999999999999999999.99', 'withdraw').expect(201);
    await reconcile();
  });
  it.each(['credit', 'debit'] as const)(
    'rolls back a %s balance update when ledger insertion fails',
    async (type) => {
      const id = await account();
      await post(id, 'credit', '100', 'seed').expect(201);
      // This trigger exists only in the throwaway cluster and fails AFTER the service's balance update.
      await pool.query(`CREATE FUNCTION ledger.test_insert_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.reference_id='force-fail' THEN RAISE EXCEPTION 'controlled insert failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER test_insert_failure BEFORE INSERT ON ledger.transactions FOR EACH ROW EXECUTE FUNCTION ledger.test_insert_failure()`);
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const result = await post(id, type, '20', 'force-fail').expect(500);
        expect(result.body.error.code).toBe('INTERNAL_ERROR');
        expect(await state(id)).toEqual({ balance: '100.00', count: 1 });
        await reconcile();
      } finally {
        log.mockRestore();
        await pool.query(
          'DROP TRIGGER test_insert_failure ON ledger.transactions; DROP FUNCTION ledger.test_insert_failure()',
        );
      }
      await post(id, type, '20', 'force-fail').expect(201);
      await reconcile();
    },
  );
  it('enforces same-account uniqueness at the database even outside the service precheck', async () => {
    const id = await account();
    await post(id, 'credit', '1', 'ref').expect(201);
    await expect(
      pool.query(
        `INSERT INTO ledger.transactions(account_id,type,amount,reference_id) VALUES($1,'credit',1,'ref')`,
        [id],
      ),
    ).rejects.toMatchObject({ code: '23505', constraint: 'transactions_account_reference_unique' });
    expect(await state(id)).toEqual({ balance: '1.00', count: 1 });
    await reconcile();
  });
  it('retains duplicate protection across fresh application instances', async () => {
    const id = await account();
    await post(id, 'credit', '1', 'persisted').expect(201);
    const restarted = createApp({ database: pool, webOrigin: 'http://localhost:5173' });
    const result = await request(restarted)
      .post(`/api/v1/accounts/${id}/transactions`)
      .send({ type: 'credit', amount: '1', reference_id: 'persisted' })
      .expect(409);
    expect(result.body.error.code).toBe('DUPLICATE_TRANSACTION');
    expect(await state(id)).toEqual({ balance: '1.00', count: 1 });
    await reconcile();
  });
  it('maps only the known ledger reference uniqueness violation to a conflict', async () => {
    const id = await account();
    const failing = createApp({
      database: {
        query: pool.query.bind(pool),
        connect: async () => {
          throw Object.assign(new Error('sensitive SQL detail'), {
            code: '23505',
            constraint: 'transactions_account_reference_unique',
          });
        },
      },
      webOrigin: 'http://localhost:5173',
    });
    const result = await request(failing)
      .post(`/api/v1/accounts/${id}/transactions`)
      .send({ type: 'credit', amount: '1', reference_id: 'ref' })
      .expect(409);
    expect(result.body.error.code).toBe('DUPLICATE_TRANSACTION');
    expect(JSON.stringify(result.body)).not.toContain('sensitive');
    expect(await state(id)).toEqual({ balance: '0.00', count: 0 });
  });
  it('serializes simultaneous debits so only one can spend the available funds', async () => {
    const id = await account();
    await post(id, 'credit', '100', 'seed').expect(201);
    const statuses = await contend(id, () => [
      post(id, 'debit', '80', 'first').then((r) => r.status),
      post(id, 'debit', '80', 'second').then((r) => r.status),
    ]);
    expect(statuses.sort()).toEqual([201, 422]);
    expect(await state(id)).toEqual({ balance: '20.00', count: 2 });
    await reconcile();
  });
  it('serializes simultaneous duplicate requests to exactly one movement', async () => {
    const id = await account();
    const statuses = await contend(id, () => [
      post(id, 'credit', '10', 'same').then((r) => r.status),
      post(id, 'credit', '10', 'same').then((r) => r.status),
    ]);
    expect(statuses.sort()).toEqual([201, 409]);
    expect(await state(id)).toEqual({ balance: '10.00', count: 1 });
    await reconcile();
  });
  it('does not lose updates under parallel mixed credits and debits', async () => {
    const id = await account();
    await post(id, 'credit', '100', 'seed').expect(201);
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        post(id, i % 2 ? 'debit' : 'credit', i % 2 ? '2' : '1', `parallel-${i}`),
      ),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(await state(id)).toEqual({ balance: '95.00', count: 11 });
    await reconcile();
  });
  it('keeps transaction editing and deletion absent', async () => {
    const id = await account();
    const response = await post(id, 'credit', '1', 'ref').expect(201);
    await request(app).get(`/api/v1/accounts/${id}/transactions`).expect(200);
    for (const method of ['put', 'patch', 'delete'] as const) {
      await request(app)
        [method](`/api/v1/accounts/${id}/transactions/${response.body.data.transaction.id}`)
        .send({ amount: '9' })
        .expect(404);
    }
    expect(await state(id)).toEqual({ balance: '1.00', count: 1 });
  });
});
