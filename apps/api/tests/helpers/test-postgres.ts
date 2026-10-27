/** Disposable local PostgreSQL 17 fixture; never reads .env or connects to hosted databases. */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

/** Reserves an ephemeral loopback port while choosing the fixture's local endpoint. */
async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No ephemeral port assigned');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

/** Starts a private cluster with the actual migration; the returned cleanup must always run. */
export async function createTestPostgres(): Promise<{ pool: pg.Pool; stop(): Promise<void> }> {
  const directory = await mkdtemp('/tmp/transaction-ledger-pg-');
  const port = await availablePort();
  const password = randomUUID();
  const postgres = new EmbeddedPostgres({
    databaseDir: join(directory, 'data'),
    port,
    user: 'postgres',
    password,
    persistent: false,
    createPostgresUser: false,
    postgresFlags: ['-h', '127.0.0.1', '-k', directory],
    onLog: () => {},
    onError: () => {},
  });
  let pool: pg.Pool | undefined;
  try {
    await postgres.initialise();
    await postgres.start();
    // Plaintext is confined to this throwaway loopback fixture. Production uses
    // createDatabasePool and mandatory CA-verified TLS; no production config is read.
    pool = new pg.Pool({
      host: '127.0.0.1',
      port,
      user: 'postgres',
      password,
      database: 'postgres',
      ssl: false,
      max: 12,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
      application_name: 'ledger-isolated-tests',
    });
    await pool.query('CREATE ROLE anon; CREATE ROLE authenticated;');
    await pool.query(
      await readFile(
        new URL(
          '../../../../supabase/migrations/20261028000000_create_ledger.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    const database = pool;
    return {
      pool: database,
      async stop() {
        try {
          await database.end();
        } finally {
          try {
            await postgres.stop();
          } finally {
            await rm(directory, { recursive: true, force: true });
          }
        }
      },
    };
  } catch (error) {
    await pool?.end();
    try {
      await postgres.stop();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
    throw error;
  }
}
