/**
 * Runs an async operation on one checked-out PostgreSQL client and transaction.
 * Owns rollback and release; callbacks must not commit, release, or use pool.query.
 */
import type { Pool, PoolClient } from 'pg';

/**
 * Commits a completed operation or rolls it back on failure, always releasing
 * the client. Failed transaction boundaries discard the connection. Never retries:
 * a failed COMMIT can have an uncertain outcome that requires caller reconciliation.
 */
export async function withTransaction<T>(
  pool: Pick<Pool, 'connect'>,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let begun = false;
  let committing = false;
  let discard = false;
  try {
    await client.query('BEGIN');
    begun = true;
    const result = await operation(client);
    committing = true;
    const commit = await client.query('COMMIT');
    // PostgreSQL responds ROLLBACK if a callback swallowed a statement failure.
    // Never report success when the database did not actually commit.
    if (commit.command !== 'COMMIT') {
      throw new Error('PostgreSQL rolled back the transaction instead of committing');
    }
    return result;
  } catch (error: unknown) {
    discard = !begun || committing;
    if (begun) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError: unknown) {
        // A client with uncertain transaction state must never return to the pool.
        discard = true;
        throw new AggregateError([error, rollbackError], 'Transaction and rollback failed', {
          cause: rollbackError,
        });
      }
    }
    throw error;
  } finally {
    client.release(discard);
  }
}
