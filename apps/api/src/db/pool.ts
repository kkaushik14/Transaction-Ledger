/**
 * Builds the API's PostgreSQL pool with mandatory certificate-verified TLS.
 * Startup owns one pool and closes it on shutdown; no database work occurs on import.
 */
import { X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { logInternalError } from '../errors/index.js';
import pg, { type PoolConfig } from 'pg';
import type { ApiEnvironment } from '../config/index.js';

/** Builds bounded pool settings; an unreadable, invalid, or expired CA fails startup. */
export function buildPoolConfig(environment: ApiEnvironment): PoolConfig {
  let ca: string;
  try {
    ca = readFileSync(environment.databaseSslCaPath, 'utf8');
    const certificate = new X509Certificate(ca);
    if (
      !certificate.ca ||
      Date.now() < Date.parse(certificate.validFrom) ||
      Date.now() >= Date.parse(certificate.validTo)
    ) {
      throw new Error('Invalid CA');
    }
  } catch (error: unknown) {
    throw new Error('DATABASE_SSL_CA_PATH must identify a readable, valid CA certificate', {
      cause: error,
    });
  }
  // Use explicit connection fields so no connection-string SSL setting can
  // replace rejectUnauthorized or the selected trust anchor, even for direct callers.
  const url = new URL(environment.databaseUrl);
  return {
    host: url.hostname.replace(/^\[|\]$/g, ''),
    port: Number(url.port || '5432'),
    database: decodeURIComponent(url.pathname.slice(1)),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: { ca, rejectUnauthorized: true },
    max: environment.databasePoolMax,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 15_000,
    idle_in_transaction_session_timeout: 30_000,
    application_name: 'transaction-ledger-api',
  };
}

/** Creates one managed pool per API process; callers must await pool.end() on shutdown. */
export function createDatabasePool(environment: ApiEnvironment): pg.Pool {
  const pool = new pg.Pool(buildPoolConfig(environment));
  // pg removes failed idle clients. Handle its error event without logging driver
  // messages, which may contain SQL or sensitive connection context.
  pool.on('error', (error: unknown) => {
    logInternalError(error, 'database.idle-client');
  });
  return pool;
}
