/**
 * Validates configuration and verifies PostgreSQL before starting the account, transaction/history and transfer API.
 * Owns the single process pool and drains HTTP/database resources on termination.
 */
import type { Server } from 'node:http';
import type { Pool } from 'pg';
import { createApp } from './index.js';
import { EnvironmentValidationError, parseEnvironment } from './config/index.js';
import { createDatabasePool } from './db/index.js';

let pool: Pool | undefined;
let server: Server | undefined;
let stopping: Promise<void> | undefined;

/** Drains requests before closing the pool; repeated signals share one shutdown. */
function shutdown(): Promise<void> {
  stopping ??= (async () => {
    // Bound shutdown if a future handler leaves an active request or client open.
    const deadline = setTimeout(() => process.exit(1), 15_000);
    deadline.unref();
    try {
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server?.close((error) => (error ? reject(error) : resolve()));
        });
      }
    } finally {
      try {
        await pool?.end();
      } finally {
        clearTimeout(deadline);
      }
    }
  })();
  return stopping;
}

/** Opens the infrastructure before listening; account routes receive the verified process pool. */
async function start(): Promise<void> {
  const environment = parseEnvironment();
  const database = createDatabasePool(environment);
  pool = database;
  await database.query('SELECT 1');
  server = await new Promise<Server>((resolve, reject) => {
    const listener = createApp({ database, webOrigin: environment.webOrigin }).listen(
      environment.port,
      () => resolve(listener),
    );
    listener.once('error', reject);
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void shutdown().catch(() => {
        console.error('API shutdown failed.');
        process.exitCode = 1;
      });
    });
  }
  console.info(`API listening on port ${environment.port}; verified TLS database pool is ready.`);
}

void start().catch(async (error: unknown) => {
  // Raw driver errors can include secret connection details. Validation errors
  // deliberately contain only field names and are safe to print.
  console.error(
    error instanceof EnvironmentValidationError
      ? error.message
      : 'API startup failed. Check database connectivity, CA certificate, and listener settings.',
  );
  process.exitCode = 1;
  await shutdown().catch(() => console.error('API cleanup failed.'));
});
