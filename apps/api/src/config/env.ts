/**
 * Validates API environment values without exposing secret input in errors.
 * Resolves certificate paths relative to the API workspace, including built code.
 */
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const apiDirectory = fileURLToPath(new URL('../../', import.meta.url));
const defaultCaPath = fileURLToPath(
  new URL('../../../../supabase/certs/prod-ca-2021.crt', import.meta.url),
);

/** Accepts PostgreSQL URLs without query options that can override verified TLS. */
function isDatabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      ['postgres:', 'postgresql:'].includes(url.protocol) &&
      Boolean(url.hostname && url.username && url.password && url.pathname.length > 1) &&
      (!url.port || (Number(url.port) >= 1 && Number(url.port) <= 65535)) &&
      !url.hash &&
      [...url.searchParams.keys()].every((key) => key === 'sslmode') &&
      url.searchParams.getAll('sslmode').length <= 1 &&
      (!url.searchParams.has('sslmode') ||
        ['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode') ?? ''))
    );
  } catch {
    return false;
  }
}

const schema = z.object({
  DATABASE_URL: z.string().min(1).refine(isDatabaseUrl),
  PORT: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(65535)),
  NODE_ENV: z.enum(['development', 'test', 'production']),
  WEB_ORIGIN: z.string().refine((value) => {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && value === url.origin;
    } catch {
      return false;
    }
  }),
  DATABASE_SSL_CA_PATH: z.string().trim().min(1).optional(),
  DATABASE_POOL_MAX: z
    .string()
    .regex(/^\d+$/)
    .default('5')
    .transform(Number)
    .pipe(z.number().int().min(1).max(20)),
});

/** Indicates invalid variable names only; raw Zod issues can contain secrets. */
export class EnvironmentValidationError extends Error {
  constructor(fields: string[]) {
    super(`Invalid or missing API environment variables: ${fields.join(', ')}`);
    this.name = 'EnvironmentValidationError';
  }
}

/** Fully validated, server-only configuration. Never serialize this object. */
export interface ApiEnvironment {
  readonly databaseUrl: string;
  readonly port: number;
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly webOrigin: string;
  readonly databaseSslCaPath: string;
  readonly databasePoolMax: number;
}

/** Parses supplied environment values; importing this module does not load secrets. */
export function parseEnvironment(source: NodeJS.ProcessEnv = process.env): ApiEnvironment {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new EnvironmentValidationError([
      ...new Set(result.error.issues.map((issue) => String(issue.path[0]))),
    ]);
  }
  const values = result.data;
  const url = new URL(values.DATABASE_URL);
  // pg lets URL SSL options replace the explicit TLS object. Remove the accepted
  // mode hint so our CA and hostname verification always remain authoritative.
  url.searchParams.delete('sslmode');
  const caPath = values.DATABASE_SSL_CA_PATH;
  return Object.freeze({
    databaseUrl: url.toString(),
    port: values.PORT,
    nodeEnv: values.NODE_ENV,
    webOrigin: values.WEB_ORIGIN,
    databasePoolMax: values.DATABASE_POOL_MAX,
    databaseSslCaPath: caPath
      ? isAbsolute(caPath)
        ? caPath
        : resolve(apiDirectory, caPath)
      : defaultCaPath,
  });
}
