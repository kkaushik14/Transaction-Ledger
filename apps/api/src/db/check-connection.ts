/**
 * Read-only infrastructure smoke check for the configured API pool and helper.
 * Does not create tables or write account/transaction data; never prints credentials.
 */
import { parseEnvironment } from '../config/index.js';
import { logInternalError } from '../errors/index.js';
import { createDatabasePool } from './pool.js';
import { withTransaction } from './transaction.js';

try {
  const pool = createDatabasePool(parseEnvironment());
  try {
    await withTransaction(pool, async (client) => {
      await client.query('SET TRANSACTION READ ONLY');
      await client.query('SELECT 1');
    });
    const expected = new Error('Controlled rollback check');
    try {
      await withTransaction(pool, async (client) => {
        await client.query('SET TRANSACTION READ ONLY');
        await client.query('SELECT 1');
        throw expected;
      });
    } catch (error: unknown) {
      if (error !== expected) throw error;
    }
    await pool.query('SELECT 1');
    console.info('Verified TLS database connection, transaction commit/rollback, and pool reuse.');
  } finally {
    await pool.end();
  }
} catch (error: unknown) {
  logInternalError(error, 'database.check');
  process.exitCode = 1;
}
