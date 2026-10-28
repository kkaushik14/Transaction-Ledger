/**
 * Read-only infrastructure smoke check for the configured API pool and helper.
 * Does not create tables or write account/transaction data; never prints credentials.
 */
import { EnvironmentValidationError, parseEnvironment } from '../config/index.js';
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
    } catch (error) {
      if (error !== expected) throw error;
    }
    await pool.query('SELECT 1');
    console.info('Verified TLS database connection, transaction commit/rollback, and pool reuse.');
  } finally {
    await pool.end();
  }
} catch (error) {
  console.error(
    error instanceof EnvironmentValidationError
      ? error.message
      : 'Database check failed. Check connection settings, CA certificate, and network access.',
  );
  process.exitCode = 1;
}
