/** Typed HTTP boundary; only public API URLs and contract-validated data enter the browser. */
import {
  apiErrorResponseSchema,
  publicFailureSchema,
  resolveErrorMessage,
  type ErrorCode,
} from '@ledger/contracts';
import type { ZodType } from 'zod';
import { ApiClientError, reportError } from '../errors/index.js';
export { ApiClientError } from '../errors/index.js';
export type ClientErrorCode = ErrorCode;
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
  } catch (error: unknown) {
    throw reportError(
      new ApiClientError('API configuration invalid', 'CONFIGURATION_ERROR', 0, { cause: error }),
      'api.configuration',
    );
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
    const ticket = publicFailureSchema.shape.support_ticket_id.safeParse(
      response.headers.get('X-Support-Ticket-ID'),
    );
    const headerTicketId = ticket.success ? ticket.data.toLowerCase() : undefined;
    let body: unknown;
    try {
      body = await response.json();
    } catch (error: unknown) {
      throw new ApiClientError(
        'The server response could not be confirmed. Refresh your account before retrying.',
        'INVALID_RESPONSE',
        response.status,
        { cause: error },
        headerTicketId,
      );
    }
    const bodyTicket = publicFailureSchema.shape.support_ticket_id.safeParse(
      typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof body.error === 'object' &&
        body.error !== null &&
        'support_ticket_id' in body.error
        ? body.error.support_ticket_id
        : undefined,
    );
    const bodyTicketId = bodyTicket.success ? bodyTicket.data.toLowerCase() : undefined;
    const supportTicketId = headerTicketId ?? bodyTicketId;
    if (!response.ok) {
      const parsed = apiErrorResponseSchema.safeParse(body);
      if (parsed.success) {
        if (headerTicketId && headerTicketId !== bodyTicketId)
          throw new ApiClientError(
            'Response support IDs disagree',
            'INVALID_RESPONSE',
            response.status,
            { cause: new Error('Support correlation mismatch') },
            headerTicketId,
          );
        throw new ApiClientError(
          'API rejected the request',
          parsed.data.error.code,
          response.status,
          undefined,
          supportTicketId,
        );
      }
      throw new ApiClientError(
        'The server returned an unexpected response.',
        'INVALID_RESPONSE',
        response.status,
        { cause: parsed.error },
        supportTicketId,
      );
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      throw new ApiClientError(
        'The server response could not be confirmed. Refresh your account before retrying.',
        'INVALID_RESPONSE',
        response.status,
        { cause: parsed.error },
        supportTicketId,
      );
    return parsed.data;
  } catch (error: unknown) {
    if (options.signal?.aborted) {
      console.debug('Superseded request cancelled');
      throw error;
    }
    if (error instanceof ApiClientError) throw reportError(error, 'api.request');
    throw reportError(
      new ApiClientError(
        'Connection interrupted. We could not confirm the result.',
        'NETWORK_ERROR',
        0,
        { cause: error },
      ),
      'api.request',
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}
/** Converts unknown failures into a stable human message without leaking raw internal errors. */
export function errorMessage(error: unknown): string {
  return resolveErrorMessage(error instanceof ApiClientError ? error.code : 'INTERNAL_ERROR')
    .message;
}
