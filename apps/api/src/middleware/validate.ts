/** Validates untrusted HTTP inputs with shared Zod contracts before controllers run. */
import type { Request, RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ApiError } from '../errors/api-error.js';

/** Parses one request source and returns only safe issue metadata on failure. */
function parseInput<T>(schema: ZodType<T>, input: unknown, source: string): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    // Expose field paths and issue codes, never request values or raw parser errors.
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', {
      issues: result.error.issues.map((issue) => ({
        path: [source, ...issue.path.map(String)].join('.'),
        code: issue.code,
      })),
    });
  }
  return result.data;
}

/** Validates params/body; only the body is replaced with its normalized value. */
export function validate(schema: ZodType, source: 'body' | 'params'): RequestHandler {
  return (request, _response, next) => {
    const parsed = parseInput(schema, request[source], source);
    if (source === 'body') request.body = parsed;
    next();
  };
}

/** Saves typed parsed query values in locals because Express 5 request.query is read-only. */
export function validateQuery<T>(
  schema: ZodType<T>,
): RequestHandler<Record<string, string>, unknown, unknown, Request['query'], { query: T }> {
  return (request, response, next) => {
    response.locals.query = parseInput(schema, request.query, 'query');
    next();
  };
}

/** Requires JSON for mutation requests; body validation still handles absent/empty JSON. */
export const requireJson: RequestHandler = (request, _response, next) => {
  const mediaType = request.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
  }
  next();
};
