/** Reliability audit: real COMMIT boundaries, rollback-independent diagnostics and whole-ledger invariants.
 * All accounts, triggers, credentials and faults belong to a throwaway local PostgreSQL cluster.
 */
import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import type { Express } from 'express';
import type { PoolClient } from 'pg';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  apiErrorResponseSchema,
  resolveErrorMessage,
  transactionHistoryResponseSchema,
  type ApiErrorCode,
  type Transaction,
  type Transfer,
} from '@ledger/contracts';
import { createApp } from '../../src/index.js';
import { createErrorLogger } from '../../src/errors/index.js';
import { createTestPostgres } from '../helpers/index.js';

let fixture: Awaited<ReturnType<typeof createTestPostgres>>;
let app: Express;
const lines: string[] = [];
const logger = createErrorLogger((line) => lines.push(line));
const kinds = ['credit', 'debit', 'transfer'] as const;
type Kind = (typeof kinds)[number];
/** Database snapshots keep native timestamps and exact decimal strings, including transfer links. */
type EntryRow = Omit<Transaction, 'created_at'> & { created_at: Date; transfer_id: string | null };
type TransferRow = Omit<Transfer, 'created_at'> & { created_at: Date };
interface AccountRow {
  id: string;
  name: string;
  balance: string;
  created_at: Date;
}

beforeAll(async () => {
  fixture = await createTestPostgres();
  app = createApp({ database: fixture.pool, webOrigin: 'http://localhost:5173', logger });
}, 60000);
beforeEach(async () => {
  await fixture.pool.query('TRUNCATE ledger.transactions, ledger.transfers, ledger.accounts');
  lines.length = 0;
});
afterAll(async () => {
  await fixture?.stop();
}, 30000);

/** Reads every stored field after all requests settle, so rejected writes cannot silently alter metadata. */
async function snapshot() {
  return {
    accounts: (await fixture.pool.query<AccountRow>('SELECT * FROM ledger.accounts ORDER BY id'))
      .rows,
    entries: (await fixture.pool.query<EntryRow>('SELECT * FROM ledger.transactions ORDER BY id'))
      .rows,
    transfers: (await fixture.pool.query<TransferRow>('SELECT * FROM ledger.transfers ORDER BY id'))
      .rows,
  };
}
/** Reconciles in NUMERIC inside PostgreSQL and checks complete, correlated transfer legs after every case. */
async function invariants() {
  const balances = await fixture.pool
    .query(`SELECT a.id FROM ledger.accounts a LEFT JOIN ledger.transactions t ON t.account_id=a.id
    GROUP BY a.id HAVING a.balance < 0 OR a.balance <> COALESCE(SUM(CASE WHEN t.type='credit' THEN t.amount ELSE -t.amount END),0)`);
  expect(balances.rows).toEqual([]);
  const legs = await fixture.pool
    .query(`SELECT f.id FROM ledger.transfers f LEFT JOIN ledger.transactions t ON t.transfer_id=f.id
    GROUP BY f.id HAVING count(t.id)<>2 OR
    count(*) FILTER (WHERE t.type='debit' AND t.account_id=f.source_account_id AND t.amount=f.amount AND t.reference_id=f.reference_id AND t.description=f.description)<>1 OR
    count(*) FILTER (WHERE t.type='credit' AND t.account_id=f.destination_account_id AND t.amount=f.amount AND t.reference_id=f.reference_id AND t.description=f.description)<>1`);
  expect(legs.rows).toEqual([]);
  const dangling = await fixture.pool.query(
    `SELECT pid FROM pg_stat_activity WHERE application_name='ledger-isolated-tests' AND state='idle in transaction'`,
  );
  expect(dangling.rows).toEqual([]);
}
afterEach(invariants);

/** Funds known test balances only through public endpoints, keeping ledger sums authoritative. */
async function account(amount = '100.00'): Promise<string> {
  const created = await request(app)
    .post('/api/v1/accounts')
    .send({ name: 'Isolated reliability audit' })
    .expect(201);
  const id: string = created.body.data.id;
  if (amount !== '0.00')
    await request(app)
      .post(`/api/v1/accounts/${id}/transactions`)
      .send({ type: 'credit', amount, reference_id: 'funding' })
      .expect(201);
  return id;
}
/** Produces the same reference/payload for explicit retry, never a new logical operation. */
async function command(kind: Kind) {
  const source = await account(),
    destination = await account('10.00');
  const shared = {
    amount: '20.00',
    description: 'Audit movement',
    reference_id: 'audit-operation',
  };
  return {
    source,
    destination,
    path: kind === 'transfer' ? '/api/v1/transfers' : `/api/v1/accounts/${source}/transactions`,
    body:
      kind === 'transfer'
        ? { ...shared, source_account_id: source, destination_account_id: destination }
        : { ...shared, type: kind },
  };
}
/** Checks the complete mapped public contract and its exact privately logged support correlation. */
function failure(response: request.Response, code: ApiErrorCode, records = lines) {
  const parsed = apiErrorResponseSchema.parse(response.body).error;
  expect(parsed).toEqual({
    code,
    support_ticket_id: response.headers['x-support-ticket-id'],
    ...resolveErrorMessage(code),
  });
  expect(Object.keys(response.body.error).sort()).toEqual([
    'action',
    'code',
    'message',
    'support_ticket_id',
  ]);
  const matching = records
    .map((line) => JSON.parse(line) as { supportTicketId: string; code: string })
    .filter((line) => line.supportTicketId === parsed.support_ticket_id);
  expect(matching).toHaveLength(1);
  expect(matching[0]?.code).toBe(code);
}

/** Intercepts only a real COMMIT acknowledgement; all SQL still runs on the real acquired pg client. */
function loseCommitAcknowledgement() {
  let injected = false;
  return createApp({
    webOrigin: 'http://localhost:5173',
    logger,
    database: {
      query: fixture.pool.query.bind(fixture.pool),
      connect: async () => {
        const client = await fixture.pool.connect();
        return new Proxy(client, {
          get(target, key) {
            if (key === 'query')
              return async (...args: Parameters<PoolClient['query']>) => {
                const result = await Reflect.apply(target.query, target, args);
                if (args[0] === 'COMMIT' && !injected) {
                  injected = true;
                  throw new Error('Commit acknowledgement lost after durable commit');
                }
                return result;
              };
            const value: unknown = Reflect.get(target, key);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
      },
    },
  });
}

describe('critical: actual COMMIT and retry boundaries', () => {
  it.each(kinds)(
    'a committed %s with a lost driver acknowledgement cannot be applied twice',
    async (kind) => {
      const intended = await command(kind);
      const before = await snapshot();
      const uncertain = await request(loseCommitAcknowledgement())
        .post(intended.path)
        .send(intended.body)
        .expect(500);
      failure(uncertain, 'INTERNAL_ERROR');
      const committed = await snapshot();
      expect(committed.entries).toHaveLength(before.entries.length + (kind === 'transfer' ? 2 : 1));
      expect(committed.transfers).toHaveLength(kind === 'transfer' ? 1 : 0);
      const balances = (
        await fixture.pool.query<{ id: string; balance: string }>(
          'SELECT id, balance::text FROM ledger.accounts',
        )
      ).rows;
      expect(balances.find((row) => row.id === intended.source)?.balance).toBe(
        kind === 'credit' ? '120.00' : '80.00',
      );
      expect(balances.find((row) => row.id === intended.destination)?.balance).toBe(
        kind === 'transfer' ? '30.00' : '10.00',
      );
      // A fresh app instance proves deduplication survives memory/process state loss.
      const restarted = createApp({
        database: fixture.pool,
        webOrigin: 'http://localhost:5173',
        logger,
      });
      for (let retry = 0; retry < 2; retry++) {
        const conflict = await request(restarted)
          .post(intended.path)
          .send(intended.body)
          .expect(409);
        failure(conflict, kind === 'transfer' ? 'DUPLICATE_TRANSFER' : 'DUPLICATE_TRANSACTION');
        expect(await snapshot()).toEqual(committed);
      }
    },
  );

  it.each(kinds)(
    'a deferred PostgreSQL COMMIT failure rolls back every %s write and preserves private file diagnostics',
    async (kind) => {
      const intended = await command(kind),
        before = await snapshot();
      const directory = await mkdtemp('/tmp/ledger-audit-diagnostics-');
      const path = join(directory, 'errors.jsonl');
      // This private filesystem sink is deliberately outside the financial DB transaction.
      const fileLogger = createErrorLogger((line) =>
        appendFileSync(path, `${line}\n`, { mode: 0o600 }),
      );
      const audited = createApp({
        database: fixture.pool,
        webOrigin: 'http://localhost:5173',
        logger: fileLogger,
      });
      await fixture.pool
        .query(`CREATE FUNCTION ledger.audit_commit_fault() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.reference_id='audit-operation' THEN RAISE EXCEPTION 'controlled commit failure password=audit-password Bearer audit-token postgres://audit:password@invalid/db'; END IF; RETURN NEW; END $$;
      CREATE CONSTRAINT TRIGGER audit_commit_fault AFTER INSERT ON ledger.transactions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ledger.audit_commit_fault()`);
      try {
        const rejected = await request(audited).post(intended.path).send(intended.body).expect(500);
        expect(await snapshot()).toEqual(before);
        const text = await readFile(path, 'utf8');
        failure(rejected, 'INTERNAL_ERROR', text.trim().split('\n'));
        expect(text).toContain('controlled commit failure');
        for (const secret of ['audit-password', 'audit-token', 'postgres://audit'])
          expect(text).not.toContain(secret);
        expect(JSON.stringify(rejected.body)).not.toContain('controlled commit failure');
        expect((await stat(directory)).mode & 0o077).toBe(0);
        expect((await stat(path)).mode & 0o077).toBe(0);
      } finally {
        await fixture.pool.query(
          'DROP TRIGGER audit_commit_fault ON ledger.transactions; DROP FUNCTION ledger.audit_commit_fault()',
        );
        await rm(directory, { recursive: true, force: true });
      }
      // Rollback must release the failed reference as well as money/rows.
      await request(app).post(intended.path).send(intended.body).expect(201);
    },
  );

  it('prevents an eight-request debit burst from overspending or leaving rejected ledger rows', async () => {
    const source = await account(),
      blocker = await fixture.pool.connect();
    let pending: Promise<request.Response>[] = [];
    try {
      await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM ledger.accounts WHERE id=$1 FOR UPDATE', [source]);
      pending = Array.from({ length: 8 }, (_, i) =>
        request(app)
          .post(`/api/v1/accounts/${source}/transactions`)
          .send({ type: 'debit', amount: '30.00', reference_id: `burst-${i}` })
          .then((response) => response),
      );
      let waiting = 0;
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        waiting =
          (
            await fixture.pool.query(
              `SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name='ledger-isolated-tests' AND wait_event_type='Lock' AND query LIKE 'SELECT id FROM ledger.accounts%'`,
            )
          ).rows[0]?.count ?? 0;
        if (waiting === 8) break;
        await pause(10);
      }
      expect(waiting).toBe(8);
      await blocker.query('COMMIT');
      const results = await Promise.all(pending);
      expect(results.filter((result) => result.status === 201)).toHaveLength(3);
      const rejected = results.filter((result) => result.status === 422);
      expect(rejected).toHaveLength(5);
      rejected.forEach((result) => failure(result, 'INSUFFICIENT_BALANCE'));
      const state = await snapshot();
      expect(state.entries).toHaveLength(4);
      expect(state.accounts[0]?.balance).toBe('10.00');
      const stored = state.entries.map((row) => row.reference_id);
      for (let i = 0; i < results.length; i++)
        expect(stored.includes(`burst-${i}`)).toBe(results[i]?.status === 201);
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
      await Promise.allSettled(pending);
    }
  });
});

describe('high: rejected writes preserve complete persisted state', () => {
  const invalid = ['0', '0.00', '-0.01', '1.001', '2.000', 'abc', '1e2', '1.2.3', 1, null];
  for (const kind of kinds)
    it.each(invalid)(
      `${kind} rejects amount %j without changing any account, ledger or transfer field`,
      async (amount) => {
        const intended = await command(kind),
          before = await snapshot();
        const rejected = await request(app)
          .post(intended.path)
          .send({ ...intended.body, amount })
          .expect(400);
        failure(rejected, 'VALIDATION_ERROR');
        expect(await snapshot()).toEqual(before);
      },
    );

  it.each([
    'balance',
    'history',
    'credit',
    'debit',
    'transfer source',
    'transfer destination',
    'transfer both',
  ] as const)('%s rejects nonexistent accounts without changing the ledger', async (operation) => {
    const intended = await command(
      operation.startsWith('transfer') ? 'transfer' : operation === 'debit' ? 'debit' : 'credit',
    );
    const before = await snapshot(),
      missing = randomUUID();
    const rejected =
      operation === 'balance' || operation === 'history'
        ? await request(app)
            .get(
              `/api/v1/accounts/${missing}/${operation === 'balance' ? 'balance' : 'transactions'}`,
            )
            .expect(404)
        : await request(app)
            .post(
              operation.startsWith('transfer')
                ? intended.path
                : `/api/v1/accounts/${missing}/transactions`,
            )
            .send(
              operation.startsWith('transfer')
                ? {
                    ...intended.body,
                    source_account_id:
                      operation !== 'transfer destination' ? missing : intended.source,
                    destination_account_id:
                      operation !== 'transfer source' ? randomUUID() : intended.destination,
                  }
                : intended.body,
            )
            .expect(404);
    failure(rejected, 'ACCOUNT_NOT_FOUND');
    expect(await snapshot()).toEqual(before);
  });

  it.each(['put', 'patch', 'delete'] as const)(
    '%s cannot alter standalone entries, transfer identities or either transfer leg through any exposed route',
    async (method) => {
      const intended = await command('transfer');
      const created = await request(app).post(intended.path).send(intended.body).expect(201);
      const before = await snapshot();
      for (const entry of before.entries)
        for (const path of [
          `/api/v1/accounts/${entry.account_id}/transactions/${entry.id}`,
          `/api/v1/transactions/${entry.id}`,
        ]) {
          const rejected = await request(app)
            [method](path)
            .send({ amount: '999', description: 'tampered' })
            .expect(404);
          failure(rejected, 'ROUTE_NOT_FOUND');
        }
      for (const path of [
        `/api/v1/transfers/${created.body.data.transfer.id}`,
        `/api/v1/accounts/${intended.source}/transactions`,
      ]) {
        const rejected = await request(app)[method](path).send({ amount: '999' }).expect(404);
        failure(rejected, 'ROUTE_NOT_FOUND');
      }
      expect(await snapshot()).toEqual(before);
    },
  );
});

// Existing history cases cover equal timestamps, repeatable-read snapshots and invalid query bounds.
describe('medium: history across standalone and transfer movements', () => {
  it('walks every filtered page with exact totals, no duplicates, stable latest-first order and reconciled balances', async () => {
    const intended = await command('transfer');
    await request(app).post(intended.path).send(intended.body).expect(201);
    for (const [type, amount, ref] of [
      ['credit', '0.01', 'cent'],
      ['debit', '1.20', 'purchase'],
      ['credit', '5.25', 'addition'],
    ] as const)
      await request(app)
        .post(`/api/v1/accounts/${intended.source}/transactions`)
        .send({ type, amount, reference_id: ref })
        .expect(201);
    const before = await snapshot();
    for (const id of [intended.source, intended.destination])
      for (const type of ['all', 'credit', 'debit']) {
        const expected = before.entries
          .filter((row) => row.account_id === id && (type === 'all' || row.type === type))
          .sort(
            (a, b) => b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id),
          );
        const ids: string[] = [];
        const pages = Math.ceil(expected.length / 2);
        for (let page = 1; page <= pages + 1; page++) {
          const response = await request(app)
            .get(`/api/v1/accounts/${id}/transactions`)
            .query({ page, limit: 2, ...(type === 'all' ? {} : { type }) })
            .expect(200);
          const body = transactionHistoryResponseSchema.parse(response.body);
          expect(body.pagination).toEqual({
            page,
            limit: 2,
            total_records: expected.length,
            total_pages: pages,
          });
          expect(body.data.map((row) => row.id)).toEqual(
            expected.slice((page - 1) * 2, page * 2).map((row) => row.id),
          );
          ids.push(...body.data.map((row) => row.id));
        }
        expect(new Set(ids).size).toBe(expected.length);
      }
    expect(await snapshot()).toEqual(before);
  });
});
