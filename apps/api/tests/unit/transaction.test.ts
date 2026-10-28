/** Exercises transaction ownership, failures, and release without touching hosted ledger data. */
import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { withTransaction } from '../../src/db/index.js';

/** Constructs a narrow pg fixture; the cast supplies unused driver members only in tests. */
function fixture() {
  const query = vi.fn(async (sql: string) => ({ command: sql }));
  const release = vi.fn();
  const client = { query, release } as unknown as PoolClient;
  return { pool: { connect: vi.fn(async () => client) }, client, query, release };
}

describe('withTransaction', () => {
  it('runs all work on one acquired client, commits, and returns the result', async () => {
    const f = fixture();
    expect(
      await withTransaction(f.pool, async (client) => {
        expect(client).toBe(f.client);
        await client.query('SELECT 1');
        return 'result';
      }),
    ).toBe('result');
    expect(f.pool.connect).toHaveBeenCalledTimes(1);
    expect(f.query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'SELECT 1', 'COMMIT']);
    expect(f.release).toHaveBeenCalledExactlyOnceWith(false);
  });
  it('preserves operation errors after rollback and returns a healthy client', async () => {
    const f = fixture();
    const error = new Error('operation failed');
    await expect(
      withTransaction(f.pool, async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(f.query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'ROLLBACK']);
    expect(f.release).toHaveBeenCalledExactlyOnceWith(false);
  });
  it('keeps both errors and discards the client when rollback fails', async () => {
    const f = fixture();
    const original = new Error('operation');
    const rollback = new Error('rollback');
    f.query.mockImplementation(async (sql) => {
      if (sql === 'ROLLBACK') throw rollback;
      return { command: sql };
    });
    await expect(
      withTransaction(f.pool, async () => {
        throw original;
      }),
    ).rejects.toMatchObject({ errors: [original, rollback] });
    expect(f.release).toHaveBeenCalledExactlyOnceWith(true);
  });
  it('discards a client if BEGIN fails, with no operation or rollback', async () => {
    const f = fixture();
    const error = new Error('begin failed');
    const operation = vi.fn();
    f.query.mockRejectedValue(error);
    await expect(withTransaction(f.pool, operation)).rejects.toBe(error);
    expect(operation).not.toHaveBeenCalled();
    expect(f.query).toHaveBeenCalledTimes(1);
    expect(f.release).toHaveBeenCalledExactlyOnceWith(true);
  });
  it('does not retry an uncertain COMMIT and discards that client', async () => {
    const f = fixture();
    const error = new Error('commit failed');
    const operation = vi.fn(async () => 1);
    f.query.mockImplementation(async (sql) => {
      if (sql === 'COMMIT') throw error;
      return { command: sql };
    });
    await expect(withTransaction(f.pool, operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(f.query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'COMMIT', 'ROLLBACK']);
    expect(f.release).toHaveBeenCalledExactlyOnceWith(true);
  });
  it('rejects a COMMIT response reporting ROLLBACK after a swallowed SQL error', async () => {
    const f = fixture();
    f.query.mockImplementation(async (sql) => ({ command: sql === 'COMMIT' ? 'ROLLBACK' : sql }));
    await expect(withTransaction(f.pool, async () => 1)).rejects.toThrow('instead of committing');
    expect(f.release).toHaveBeenCalledExactlyOnceWith(true);
  });
  it('propagates acquisition failure without invoking the operation', async () => {
    const f = fixture();
    const error = new Error('unavailable');
    const operation = vi.fn();
    f.pool.connect.mockRejectedValue(error);
    await expect(withTransaction(f.pool, operation)).rejects.toBe(error);
    expect(operation).not.toHaveBeenCalled();
    expect(f.release).not.toHaveBeenCalled();
  });
});
