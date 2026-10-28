/** Verifies fail-closed TLS configuration and pool limits without opening network connections. */
import { describe, expect, it, vi } from 'vitest';
import { parseEnvironment } from '../../src/config/index.js';
import { buildPoolConfig, createDatabasePool } from '../../src/db/index.js';

const environment = parseEnvironment({
  DATABASE_URL: 'postgresql://demo:p%40ss@db.example.com:5432/postgres?sslmode=require',
  PORT: '3000',
  NODE_ENV: 'test',
  WEB_ORIGIN: 'http://localhost:5173',
});

describe('database pool', () => {
  it('enforces verified TLS with the Supabase CA and exact decoded credentials', () => {
    const config = buildPoolConfig(environment);
    expect(config.ssl).toMatchObject({
      rejectUnauthorized: true,
      ca: expect.stringContaining('BEGIN CERTIFICATE'),
    });
    expect(config).toMatchObject({
      host: 'db.example.com',
      user: 'demo',
      password: 'p@ss',
      database: 'postgres',
      max: 5,
    });
    expect(config.connectionString).toBeUndefined();
    expect(config.connectionTimeoutMillis).toBeGreaterThan(0);
    expect(config.statement_timeout).toBeGreaterThan(0);
  });
  it('does not let URL options disable certificate verification even for direct callers', () => {
    const config = buildPoolConfig({
      ...environment,
      databaseUrl: `${environment.databaseUrl}?sslmode=disable`,
    });
    expect(config.ssl).toMatchObject({ rejectUnauthorized: true });
  });
  it('rejects an unreadable CA without exposing connection credentials', () => {
    expect(() => buildPoolConfig({ ...environment, databaseSslCaPath: '/missing/ca.crt' })).toThrow(
      'DATABASE_SSL_CA_PATH must identify a readable, valid CA certificate',
    );
  });
  it('rejects a readable file that is not a CA certificate', () => {
    expect(() =>
      buildPoolConfig({
        ...environment,
        databaseSslCaPath: new URL('../../package.json', import.meta.url).pathname,
      }),
    ).toThrow('DATABASE_SSL_CA_PATH');
  });
  it('handles idle errors without logging a driver message or throwing', async () => {
    const pool = createDatabasePool(environment);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      pool.emit('error', new Error('secret-database-password'));
      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls.flat().join(' ')).not.toContain('secret-database-password');
      expect(pool.totalCount).toBe(0);
    } finally {
      log.mockRestore();
      await pool.end();
    }
  });
});
