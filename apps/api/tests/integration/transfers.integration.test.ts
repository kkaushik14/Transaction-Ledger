/** Atomic transfer, migration upgrade and real row-lock contention tests; never reads .env or hosted data. */
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as pause } from 'node:timers/promises';
import type { Express } from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTransferResponseSchema, transactionHistoryResponseSchema } from '@ledger/contracts';
import { createApp } from '../../src/index.js';
import { createTestPostgres } from '../helpers/index.js';

let fixture: Awaited<ReturnType<typeof createTestPostgres>>;
let pool: Pool;
let app: Express;
beforeAll(async () => {
  fixture = await createTestPostgres();
  pool = fixture.pool;
  app = createApp({ database: pool, webOrigin: 'http://localhost:5173' });
}, 60000);
beforeEach(async () => {
  await pool.query('TRUNCATE ledger.transactions,ledger.transfers,ledger.accounts');
});
afterAll(async () => {
  await fixture?.stop();
}, 30000);

/** Creates and optionally funds an isolated account through the real HTTP API. */
async function account(balance?: string): Promise<string> {
  const created = await request(app)
    .post('/api/v1/accounts')
    .send({ name: 'Transfer test' })
    .expect(201);
  const id: string = created.body.data.id;
  if (balance) await movement(id, 'credit', balance, 'funding').expect(201);
  return id;
}
/** Standalone movements contend on exactly the same account rows as transfers. */
function movement(id: string, type: 'credit' | 'debit', amount: string, reference_id: string) {
  return request(app)
    .post(`/api/v1/accounts/${id}/transactions`)
    .send({ type, amount, reference_id });
}
/** Submits one transfer command without retrying or generating a new reference automatically. */
function transfer(source: string, destination: string, amount = '10', reference_id = 'transfer-1') {
  return request(app)
    .post('/api/v1/transfers')
    .send({ source_account_id: source, destination_account_id: destination, amount, reference_id });
}
/** Captures every persisted field so rejected requests must leave the entire ledger unchanged. */
async function snapshot() {
  return {
    accounts: (await pool.query('SELECT * FROM ledger.accounts ORDER BY id')).rows,
    transfers: (await pool.query('SELECT * FROM ledger.transfers ORDER BY id')).rows,
    entries: (await pool.query('SELECT * FROM ledger.transactions ORDER BY id')).rows,
  };
}
/** Reads exact balances without converting NUMERIC to JavaScript numbers. */
async function balance(id: string): Promise<string> {
  return (
    await pool.query<{ balance: string }>(
      'SELECT balance::text AS balance FROM ledger.accounts WHERE id=$1',
      [id],
    )
  ).rows[0]!.balance;
}
/** Tests both materialized balance reconciliation and exactly two matching legs per transfer. */
async function reconcile() {
  const accounts =
    await pool.query(`SELECT a.id FROM ledger.accounts a LEFT JOIN ledger.transactions t ON t.account_id=a.id
    GROUP BY a.id HAVING a.balance <> COALESCE(SUM(CASE WHEN t.type='credit' THEN t.amount ELSE -t.amount END),0)`);
  expect(accounts.rows).toEqual([]);
  const transfers =
    await pool.query(`SELECT f.id FROM ledger.transfers f LEFT JOIN ledger.transactions t ON t.transfer_id=f.id
    GROUP BY f.id HAVING count(t.id)<>2 OR
    count(*) FILTER (WHERE t.type='debit' AND t.account_id=f.source_account_id AND t.amount=f.amount AND t.reference_id=f.reference_id AND t.description=f.description)<>1 OR
    count(*) FILTER (WHERE t.type='credit' AND t.account_id=f.destination_account_id AND t.amount=f.amount AND t.reference_id=f.reference_id AND t.description=f.description)<>1`);
  expect(transfers.rows).toEqual([]);
}
afterEach(reconcile);

/** Observes at least two independent blocked PostgreSQL sessions before releasing competing writes. */
async function contend(id: string, start: () => Promise<number>[]): Promise<number[]> {
  const blocker = await pool.connect();
  let pending: Promise<number>[] = [];
  try {
    await blocker.query('BEGIN');
    await blocker.query('SELECT id FROM ledger.accounts WHERE id=$1 FOR UPDATE', [id]);
    pending = start();
    const deadline = Date.now() + 5000;
    let waiting = 0;
    while (Date.now() < deadline) {
      waiting =
        (
          await pool.query<{
            count: number;
          }>(`SELECT count(DISTINCT pid)::int AS count FROM pg_stat_activity
        WHERE application_name='ledger-isolated-tests' AND wait_event_type='Lock' AND query LIKE 'SELECT id FROM ledger.accounts%'`)
        ).rows[0]?.count ?? 0;
      if (waiting >= 2) break;
      await pause(10);
    }
    expect(waiting).toBeGreaterThanOrEqual(2);
    await blocker.query('COMMIT');
    return await Promise.all(pending);
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
    await Promise.allSettled(pending);
  }
}

describe('transfer creation', () => {
  it('moves exact money once and returns correlated immutable entries visible through existing history', async () => {
    const source = await account('100.25'),
      destination = await account('1.00');
    const result = await request(app)
      .post('/api/v1/transfers')
      .send({
        source_account_id: source.toUpperCase(),
        destination_account_id: destination.toUpperCase(),
        amount: '25.5',
        reference_id: ' Ref-1 ',
        description: 'Shared expense',
      })
      .expect(201);
    const data = createTransferResponseSchema.parse(result.body).data;
    expect(data.source_account_balance).toBe('74.75');
    expect(data.destination_account_balance).toBe('26.50');
    expect(data.transfer).toMatchObject({
      source_account_id: source,
      destination_account_id: destination,
      amount: '25.50',
      reference_id: ' Ref-1 ',
      description: 'Shared expense',
    });
    expect(data.debit.transfer_id).toBe(data.transfer.id);
    expect(data.credit.transfer_id).toBe(data.transfer.id);
    for (const [id, type] of [
      [source, 'debit'],
      [destination, 'credit'],
    ] as const) {
      const history = await request(app)
        .get(`/api/v1/accounts/${id}/transactions?type=${type}`)
        .expect(200);
      const rows = transactionHistoryResponseSchema.parse(history.body).data;
      expect(rows.some((row) => row.reference_id === ' Ref-1 ' && row.amount === '25.50')).toBe(
        true,
      );
      expect(
        (await request(app).get(`/api/v1/accounts/${id}/balance`).expect(200)).body.data.balance,
      ).toBe(await balance(id));
    }
    expect(
      (await pool.query('SELECT SUM(balance)::text AS total FROM ledger.accounts')).rows[0]?.total,
    ).toBe('101.25');
  });
  it('handles the minimum unit, maximum precision and exact exhaustion without float arithmetic', async () => {
    const source = await account('999999999999999999.99'),
      destination = await account();
    await transfer(source, destination, '0.01', 'small').expect(201);
    await transfer(source, destination, '999999999999999999.98', 'rest').expect(201);
    expect(await balance(source)).toBe('0.00');
    expect(await balance(destination)).toBe('999999999999999999.99');
  });
  it.each(['source', 'destination', 'both'])(
    'rejects a missing %s account without writes',
    async (missing) => {
      const source = await account('10'),
        destination = await account();
      const before = await snapshot();
      const response = await transfer(
        missing === 'destination' ? source : randomUUID(),
        missing === 'source' ? destination : randomUUID(),
      ).expect(404);
      expect(response.body.error.code).toBe('ACCOUNT_NOT_FOUND');
      expect(await snapshot()).toEqual(before);
    },
  );
  it('rolls back the transfer identity on insufficient funds and both updates on destination overflow', async () => {
    const source = await account('1'),
      destination = await account('999999999999999999.99');
    const before = await snapshot();
    expect((await transfer(source, destination, '2').expect(422)).body.error.code).toBe(
      'INSUFFICIENT_BALANCE',
    );
    expect(await snapshot()).toEqual(before);
    expect((await transfer(source, destination, '0.01').expect(422)).body.error.code).toBe(
      'BALANCE_LIMIT_EXCEEDED',
    );
    expect(await snapshot()).toEqual(before);
  });
  it('rejects duplicate transfers, changed payloads and post-restart retries before checking exhausted funds', async () => {
    const source = await account('10'),
      destination = await account(),
      other = await account();
    await transfer(source, destination, '10').expect(201);
    const before = await snapshot();
    const restarted = createApp({ database: pool, webOrigin: 'http://localhost:5173' });
    for (const body of [
      {
        source_account_id: source,
        destination_account_id: destination,
        amount: '10',
        reference_id: 'transfer-1',
      },
      {
        source_account_id: source,
        destination_account_id: other,
        amount: '1',
        reference_id: 'transfer-1',
        description: 'Changed payload',
      },
    ]) {
      const response = await request(restarted).post('/api/v1/transfers').send(body).expect(409);
      expect(response.body.error.code).toBe('DUPLICATE_TRANSFER');
    }
    expect(await snapshot()).toEqual(before);
  });
  it.each(['source', 'destination'])(
    'rejects a standalone reference already used on the %s account',
    async (collision) => {
      const source = await account('100'),
        destination = await account();
      await movement(
        collision === 'source' ? source : destination,
        'credit',
        '1',
        'collision',
      ).expect(201);
      const before = await snapshot();
      expect(
        (await transfer(source, destination, '10', 'collision').expect(409)).body.error.code,
      ).toBe('DUPLICATE_TRANSACTION');
      expect(await snapshot()).toEqual(before);
    },
  );
  it('keeps source reference scope persistent and preserves case and whitespace on both accounts', async () => {
    const a = await account('10'),
      b = await account(),
      c = await account('10'),
      d = await account();
    await transfer(a, b, '1', 'ref').expect(201);
    await transfer(c, d, '1', 'ref').expect(201);
    await transfer(a, b, '1', 'REF').expect(201);
    await transfer(a, b, '1', ' ref ').expect(201);
    await movement(b, 'credit', '1', 'ref').expect(409);
    expect(await balance(a)).toBe('7.00');
    expect(await balance(b)).toBe('3.00');
  });
  it('keeps transfer updates/deletes and transfer listing absent', async () => {
    const source = await account('1'),
      destination = await account();
    const created = await transfer(source, destination, '1').expect(201);
    const before = await snapshot();
    for (const method of ['put', 'patch', 'delete', 'get'] as const) {
      await request(app)
        [method](`/api/v1/transfers/${created.body.data.transfer.id}`)
        .send({ amount: '0.01' })
        .expect(404);
    }
    await request(app).get('/api/v1/transfers').expect(404);
    expect(await snapshot()).toEqual(before);
  });
});

describe('transfer validation and failure handling', () => {
  it.each([
    { amount: '0' },
    { amount: '-1' },
    { amount: '1.001' },
    { amount: 1 },
    { amount: '1e2' },
    { amount: '1000000000000000000' },
    { source_account_id: 'invalid' },
    { destination_account_id: null },
    { reference_id: '' },
    { reference_id: 'x'.repeat(129) },
    { reference_id: 'bad\0ref' },
    { description: null },
    { description: 'x'.repeat(501) },
    { description: 'bad\0description' },
    { id: randomUUID() },
    { transfer_id: randomUUID() },
    { type: 'debit' },
    { balance: '100' },
  ])('rejects invalid input before acquiring a client: %j', async (fields) => {
    const connect = vi.fn(async () => pool.connect());
    const isolated = createApp({
      database: { query: pool.query.bind(pool), connect },
      webOrigin: 'http://localhost:5173',
    });
    const before = await snapshot();
    const response = await request(isolated)
      .post('/api/v1/transfers')
      .send({
        source_account_id: randomUUID(),
        destination_account_id: randomUUID(),
        amount: '1',
        reference_id: 'invalid',
        ...fields,
      })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(connect).not.toHaveBeenCalled();
    expect(await snapshot()).toEqual(before);
  });
  it('rejects same-account UUID case variants and malformed/missing/non-JSON bodies before SQL', async () => {
    const connect = vi.fn(async () => pool.connect());
    const isolated = createApp({
      database: { query: pool.query.bind(pool), connect },
      webOrigin: 'http://localhost:5173',
    });
    const id = randomUUID();
    await request(isolated)
      .post('/api/v1/transfers')
      .send({
        source_account_id: id,
        destination_account_id: id.toUpperCase(),
        amount: '1',
        reference_id: 'self',
      })
      .expect(400);
    await request(isolated)
      .post('/api/v1/transfers')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);
    await request(isolated)
      .post('/api/v1/transfers')
      .set('Content-Type', 'application/json')
      .expect(400);
    await request(isolated).post('/api/v1/transfers').type('text').send('transfer').expect(415);
    await request(isolated)
      .post('/api/v1/transfers')
      .send({ description: 'x'.repeat(17000) })
      .expect(413);
    expect(connect).not.toHaveBeenCalled();
  });
  it.each([
    'transfer',
    'source update',
    'destination update',
    'debit',
    'credit',
    'response validation',
  ])('rolls back every write on forced failure at %s', async (stage) => {
    const source = await account('100'),
      destination = await account('5');
    const before = await snapshot();
    const table =
      stage === 'transfer' ? 'transfers' : stage.includes('update') ? 'accounts' : 'transactions';
    const event = table === 'accounts' ? 'UPDATE' : 'INSERT';
    const condition =
      stage === 'transfer'
        ? 'TRUE'
        : stage.includes('update')
          ? `NEW.id='${stage.startsWith('source') ? source : destination}'::uuid`
          : `NEW.transfer_id IS NOT NULL AND NEW.type='${stage === 'debit' ? 'debit' : 'credit'}'`;
    const action =
      stage === 'response validation'
        ? 'NEW.amount := NEW.amount + 0.01; RETURN NEW;'
        : "RAISE EXCEPTION 'controlled transfer failure with private SQL details';";
    await pool.query(`CREATE FUNCTION ledger.fail_transfer_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN ${action} END IF; RETURN NEW; END $$;
      CREATE TRIGGER fail_transfer_test BEFORE ${event} ON ledger.${table} FOR EACH ROW EXECUTE FUNCTION ledger.fail_transfer_test()`);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await transfer(source, destination).expect(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(response.body)).not.toContain('private SQL');
      expect(await snapshot()).toEqual(before);
    } finally {
      log.mockRestore();
      await pool.query(
        `DROP TRIGGER fail_transfer_test ON ledger.${table}; DROP FUNCTION ledger.fail_transfer_test()`,
      );
    }
  });
  it.each([
    ['transfers_source_reference_unique', 409, 'DUPLICATE_TRANSFER'],
    ['transactions_account_reference_unique', 409, 'DUPLICATE_TRANSACTION'],
    ['unrelated_unique_constraint', 500, 'INTERNAL_ERROR'],
  ] as const)('safely maps only known constraint %s', async (constraint, status, code) => {
    const failing = createApp({
      database: {
        query: pool.query.bind(pool),
        connect: async () => {
          throw Object.assign(new Error('secret database details'), { code: '23505', constraint });
        },
      },
      webOrigin: 'http://localhost:5173',
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await request(failing)
        .post('/api/v1/transfers')
        .send({
          source_account_id: randomUUID(),
          destination_account_id: randomUUID(),
          amount: '1',
          reference_id: 'valid',
        })
        .expect(status);
      expect(response.body.error.code).toBe(code);
      expect(JSON.stringify(response.body)).not.toContain('secret');
    } finally {
      log.mockRestore();
    }
  });
});

describe('real PostgreSQL transfer contention', () => {
  it('prevents competing transfers from spending the same source funds twice', async () => {
    const source = await account('100'),
      a = await account(),
      b = await account();
    const statuses = await contend(source, () => [
      transfer(source, a, '80', 'first').then((r) => r.status),
      transfer(source, b, '80', 'second').then((r) => r.status),
    ]);
    expect(statuses.sort()).toEqual([201, 422]);
    expect(await balance(source)).toBe('20.00');
    expect(
      (await pool.query('SELECT count(*)::int AS count FROM ledger.transfers')).rows[0]?.count,
    ).toBe(1);
  });
  it('accepts exactly one simultaneous duplicate transfer', async () => {
    const source = await account('100'),
      destination = await account();
    const statuses = await contend(source, () => [
      transfer(source, destination).then((r) => r.status),
      transfer(source, destination).then((r) => r.status),
    ]);
    expect(statuses.sort()).toEqual([201, 409]);
    expect(await balance(source)).toBe('90.00');
    expect(await balance(destination)).toBe('10.00');
    expect(
      (await pool.query('SELECT count(*)::int AS count FROM ledger.transfers')).rows[0]?.count,
    ).toBe(1);
  });
  it('serializes a shared source/reference even when destination payloads differ', async () => {
    const source = await account('100'),
      a = await account(),
      b = await account();
    const statuses = await contend(source, () => [
      transfer(source, a).then((r) => r.status),
      transfer(source, b).then((r) => r.status),
    ]);
    expect(statuses.sort()).toEqual([201, 409]);
    expect(await balance(source)).toBe('90.00');
  });
  it('runs opposing transfers without deadlocks using consistent UUID lock order', async () => {
    const a = await account('100'),
      b = await account('100');
    const statuses = await contend([a, b].sort()[0]!, () => [
      transfer(a, b, '70', 'forward').then((r) => r.status),
      transfer(b, a, '70', 'reverse').then((r) => r.status),
    ]);
    expect(statuses).toEqual([201, 201]);
    expect(await balance(a)).toBe('100.00');
    expect(await balance(b)).toBe('100.00');
  });
  it('serializes competing incoming transfers at the destination capacity', async () => {
    const a = await account('0.01'),
      b = await account('0.01'),
      destination = await account('999999999999999999.98');
    const statuses = await contend(destination, () => [
      transfer(a, destination, '0.01', 'first').then((r) => r.status),
      transfer(b, destination, '0.01', 'second').then((r) => r.status),
    ]);
    expect(statuses.sort()).toEqual([201, 422]);
    expect(await balance(destination)).toBe('999999999999999999.99');
    expect([await balance(a), await balance(b)].sort()).toEqual(['0.00', '0.01']);
  });
  it('shares the source lock with standalone debits to prevent mixed-operation overdrafts', async () => {
    const source = await account('100'),
      destination = await account();
    const statuses = await contend(source, () => [
      transfer(source, destination, '80').then((r) => r.status),
      movement(source, 'debit', '80', 'standalone').then((r) => r.status),
    ]);
    expect(statuses.sort()).toEqual([201, 422]);
    expect(await balance(source)).toBe('20.00');
  });
  it('shares destination reference protection with concurrent standalone credits', async () => {
    const source = await account('100'),
      destination = await account();
    const statuses = await contend(destination, () => [
      transfer(source, destination, '10', 'shared').then((r) => r.status),
      movement(destination, 'credit', '1', 'shared').then((r) => r.status),
    ]);
    expect(statuses.sort()).toEqual([201, 409]);
    expect(['1.00', '10.00']).toContain(await balance(destination));
  });
});

describe('transfer migration and database backstops', () => {
  it('upgrades a populated initial schema without changing existing accounts or standalone entries', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Reconstruct the pre-transfer schema only inside this disposable transaction.
      await client.query(
        'ALTER TABLE ledger.transactions DROP COLUMN transfer_id; DROP TABLE ledger.transfers',
      );
      const id = randomUUID();
      await client.query(
        "INSERT INTO ledger.accounts(id,name,balance) VALUES($1,'Existing account',1.25)",
        [id],
      );
      await client.query(
        "INSERT INTO ledger.transactions(account_id,type,amount,reference_id) VALUES($1,'credit',1.25,'existing')",
        [id],
      );
      const before = (await client.query('SELECT * FROM ledger.transactions')).rows;
      // Supabase creator defaults can grant Data API roles access; the migration
      // must revoke inherited table grants as well as ordinary default permissions.
      await client.query(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA ledger GRANT ALL ON TABLES TO anon, authenticated',
      );
      await client.query(
        await readFile(
          new URL(
            '../../../../supabase/migrations/20261028050000_add_transfers.sql',
            import.meta.url,
          ),
          'utf8',
        ),
      );
      expect((await client.query('SELECT * FROM ledger.transactions')).rows).toEqual(
        before.map((row) => ({ ...row, transfer_id: null })),
      );
      expect(
        (await client.query('SELECT balance::text FROM ledger.accounts WHERE id=$1', [id])).rows[0]
          ?.balance,
      ).toBe('1.25');
      for (const role of ['anon', 'authenticated']) {
        const permissions = await client.query<{ read: boolean; write: boolean }>(
          "SELECT has_table_privilege($1,'ledger.transfers','SELECT') AS read,has_table_privilege($1,'ledger.transfers','INSERT') AS write",
          [role],
        );
        expect(permissions.rows[0]).toEqual({ read: false, write: false });
      }
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
  it('enforces transfer reference uniqueness, foreign keys and at-most-one leg of each type directly in PostgreSQL', async () => {
    const source = await account('10'),
      destination = await account();
    const result = await transfer(source, destination, '1').expect(201);
    const id = result.body.data.transfer.id;
    await expect(
      pool.query(
        'INSERT INTO ledger.transfers(source_account_id,destination_account_id,amount,reference_id) VALUES($1,$2,1,$3)',
        [source, destination, 'transfer-1'],
      ),
    ).rejects.toMatchObject({ code: '23505', constraint: 'transfers_source_reference_unique' });
    await expect(
      pool.query(
        "INSERT INTO ledger.transactions(account_id,type,amount,reference_id,transfer_id) VALUES($1,'debit',1,'another-ref',$2)",
        [source, id],
      ),
    ).rejects.toMatchObject({ code: '23505', constraint: 'transactions_transfer_type_unique' });
    await expect(
      pool.query('DELETE FROM ledger.transfers WHERE id=$1', [id]),
    ).rejects.toMatchObject({ code: '23503' });
    await expect(
      pool.query(
        'INSERT INTO ledger.transfers(source_account_id,destination_account_id,amount,reference_id) VALUES($1,$2,1,$3)',
        [source, randomUUID(), 'missing-account'],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });
  it.each([
    ['zero', 'transfers_positive_amount'],
    ['negative', 'transfers_positive_amount'],
    ['self', 'transfers_different_accounts'],
    ['blank', 'transfers_reference_not_blank'],
    ['description', 'transfers_description_length'],
  ])('enforces the %s transfer constraint in PostgreSQL', async (kind, constraint) => {
    const source = await account(),
      destination = await account();
    await expect(
      pool.query(
        'INSERT INTO ledger.transfers(source_account_id,destination_account_id,amount,reference_id,description) VALUES($1,$2,$3,$4,$5)',
        [
          source,
          kind === 'self' ? source : destination,
          kind === 'zero' ? '0' : kind === 'negative' ? '-1' : '1',
          kind === 'blank' ? '  ' : 'valid',
          kind === 'description' ? 'x'.repeat(501) : '',
        ],
      ),
    ).rejects.toMatchObject({ code: '23514', constraint });
  });
});
