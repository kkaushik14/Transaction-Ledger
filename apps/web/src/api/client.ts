/** Typed HTTP boundary; only public API URLs and contract-validated data enter the browser. */
import { apiErrorResponseSchema, type ApiErrorCode } from '@ledger/contracts';
import type { ZodType } from 'zod';
/** Public request failure categories, including uncertain network/response outcomes. */
export type ClientErrorCode =
  ApiErrorCode | 'NETWORK_ERROR' | 'INVALID_RESPONSE' | 'CONFIGURATION_ERROR';
/** Safe consumer error; no server HTML or unvalidated error body is shown to users. */
export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: ClientErrorCode,
    readonly status = 0,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ApiClientError';
  }
  get uncertain(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'INVALID_RESPONSE' || this.status >= 500;
  }
}
/** Fetches/validates one API response with cancellation and a bounded network timeout. */
export async function apiRequest<T>(
  path: string,
  schema: ZodType<T>,
  options: { method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1').replace(
    /\/$/,
    '',
  );
  try {
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      throw new Error('Invalid public API URL');
  } catch (error) {
    throw new ApiClientError('The API URL is not configured correctly.', 'CONFIGURATION_ERROR', 0, {
      cause: error,
    });
  }
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener('abort', cancel, { once: true });
  const timeout = window.setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${base}${path}`, {
      method: options.method ?? 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new ApiClientError(
        'The server response could not be confirmed. Refresh your account before retrying.',
        'INVALID_RESPONSE',
        response.status,
        { cause: error },
      );
    }
    if (!response.ok) {
      const parsed = apiErrorResponseSchema.safeParse(body);
      if (parsed.success)
        throw new ApiClientError(
          parsed.data.error.message,
          parsed.data.error.code,
          response.status,
        );
      throw new ApiClientError(
        'The server returned an unexpected response.',
        'INVALID_RESPONSE',
        response.status,
      );
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      throw new ApiClientError(
        'The server response could not be confirmed. Refresh your account before retrying.',
        'INVALID_RESPONSE',
        response.status,
      );
    return parsed.data;
  } catch (error) {
    if (options.signal?.aborted || error instanceof ApiClientError) throw error;
    throw new ApiClientError(
      'Connection interrupted. We could not confirm the result.',
      'NETWORK_ERROR',
      0,
      { cause: error },
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}
/** Converts unknown failures into a stable human message without leaking raw internal errors. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : 'Something went wrong. Please try again.';
}
