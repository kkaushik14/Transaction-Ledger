/** Tests environment validation and secret-safe errors without loading real credentials. */
import { describe, expect, it } from 'vitest';
import { EnvironmentValidationError, parseEnvironment } from '../../src/config/index.js';

const valid = {
  DATABASE_URL: 'postgresql://demo:secret@db.example.com:5432/postgres',
  PORT: '3000',
  NODE_ENV: 'test',
  WEB_ORIGIN: 'http://localhost:5173',
};

describe('API environment', () => {
  it('validates required fields and supplies bounded pool and CA defaults', () => {
    const env = parseEnvironment(valid);
    expect(env.port).toBe(3000);
    expect(env.databasePoolMax).toBe(5);
    expect(env.databaseSslCaPath).toMatch(/supabase\/certs\/prod-ca-2021.crt$/);
    expect(Object.isFrozen(env)).toBe(true);
  });
  it.each(['require', 'verify-ca', 'verify-full'])(
    'removes %s so pg cannot replace explicit TLS',
    (mode) => {
      expect(
        parseEnvironment({ ...valid, DATABASE_URL: `${valid.DATABASE_URL}?sslmode=${mode}` })
          .databaseUrl,
      ).toBe(valid.DATABASE_URL);
    },
  );
  it.each(['disable', 'prefer', 'allow', 'no-verify'])('rejects insecure SSL mode %s', (mode) => {
    expect(() =>
      parseEnvironment({ ...valid, DATABASE_URL: `${valid.DATABASE_URL}?sslmode=${mode}` }),
    ).toThrow(EnvironmentValidationError);
  });
  it.each([
    'ssl=false',
    'sslrootcert=other.crt',
    'sslkey=key',
    'host=other.example',
    'sslmode=require&sslmode=disable',
  ])('rejects URL override %s', (query) => {
    expect(() =>
      parseEnvironment({ ...valid, DATABASE_URL: `${valid.DATABASE_URL}?${query}` }),
    ).toThrow(EnvironmentValidationError);
  });
  it.each([
    { PORT: '0' },
    { PORT: '3000.5' },
    { PORT: '65536' },
    { PORT: '1e3' },
    { NODE_ENV: 'staging' },
    { WEB_ORIGIN: 'https://example.com/path' },
    { WEB_ORIGIN: 'https://user:password@example.com' },
    { DATABASE_POOL_MAX: '0' },
    { DATABASE_POOL_MAX: '21' },
    { DATABASE_SSL_CA_PATH: '' },
    { DATABASE_URL: 'https://demo:secret@example.com/db' },
    { DATABASE_URL: 'postgresql://demo@localhost/postgres' },
  ])('rejects invalid configuration %j', (overrides) => {
    expect(() => parseEnvironment({ ...valid, ...overrides })).toThrow(EnvironmentValidationError);
  });
  it('reports variable names without echoing invalid secrets', () => {
    try {
      parseEnvironment({ ...valid, DATABASE_URL: 'not-a-url-with-secret-password' });
      expect.fail('Validation should fail');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError);
      expect(String(error)).toContain('DATABASE_URL');
      expect(String(error)).not.toContain('not-a-url-with-secret-password');
    }
  });
  it('requires all four baseline variables', () => {
    expect(() => parseEnvironment({})).toThrow('DATABASE_URL, PORT, NODE_ENV, WEB_ORIGIN');
  });
  it('resolves an optional CA path independently of the working directory', () => {
    expect(
      parseEnvironment({ ...valid, DATABASE_SSL_CA_PATH: '../../supabase/certs/prod-ca-2021.crt' })
        .databaseSslCaPath,
    ).toBe(parseEnvironment(valid).databaseSslCaPath);
  });
});
