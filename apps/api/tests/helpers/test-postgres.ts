/** Disposable local PostgreSQL 17 fixture; never reads .env or connects to hosted databases. */
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
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

/** Starts a private cluster with every timestamped migration in order; cleanup must always run. */
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
  const clientEnds = new Set<Promise<void>>();
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
    // pg-pool can resolve end() after removing clients but before their sockets
    // finish closing. Await actual client end events before stopping PostgreSQL,
    // otherwise shutdown can emit FATAL errors against already-closing clients.
    pool.on('connect', (client) => {
      const ended = new Promise<void>((resolve) => {
        client.once('end', resolve);
      });
      clientEnds.add(ended);
      void ended.then(() => clientEnds.delete(ended));
    });
    await pool.query('CREATE ROLE anon; CREATE ROLE authenticated;');
    const migrations = new URL('../../../../supabase/migrations/', import.meta.url);
    // Use the actual upgrade chain so existing account/history suites also verify compatibility.
    for (const filename of (await readdir(migrations))
      .filter((name) => /^\d+_.*\.sql$/.test(name))
      .sort()) {
      await pool.query(await readFile(new URL(filename, migrations), 'utf8'));
    }
    const database = pool;
    return {
      pool: database,
      async stop() {
        try {
          await database.end();
          await Promise.all([...clientEnds]);
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
    await Promise.all([...clientEnds]);
    try {
      await postgres.stop();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
    throw error;
  }
}
