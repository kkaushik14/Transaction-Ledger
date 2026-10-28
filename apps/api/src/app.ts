/** Composes account, transaction/history and atomic transfer routes with validation, CORS and safe errors. */
import { randomUUID } from 'node:crypto';
import express, { type Express, type RequestHandler } from 'express';
import cors from 'cors';
import type { Pool } from 'pg';
import {
  createTransactionsRouter,
  createTransactionsService,
  createAccountsRouter,
  createAccountsRepository,
  type AccountDatabase,
  createAccountsService,
  createTransfersRouter,
  createTransfersService,
} from './modules/index.js';

import { ApiError, type ErrorLogger } from './errors/index.js';
import { createErrorHandler } from './middleware/index.js';

/** Supplies explicit infrastructure; application creation never reads environment secrets. */
export interface AppDependencies {
  database: AccountDatabase & Pick<Pool, 'connect'>;
  webOrigin: string;
  logger?: ErrorLogger;
}

/** Preserve the matched mount before Express unwinds nested routers on an error. */
const rememberRoutePrefix: RequestHandler = (request, response, next) => {
  response.locals.routePrefix = request.baseUrl;
  next();
};

/** Builds the injected account/transaction/transfer API, leaving pool ownership and shutdown to startup. */
export function createApp({ database, webOrigin, logger }: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use((_request, response, next) => {
    response.locals.supportTicketId = randomUUID();
    next();
  });
  // All paths receive the configured browser origin, including parse/error responses.
  // CORS precedes parsing and routing so preflight requests do not invoke domain code.
  app.use(
    cors({
      origin: webOrigin,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
      exposedHeaders: ['X-Support-Ticket-ID'],
    }),
  );
  // Parse bounded JSON before body validation; malformed/oversized requests reach
  // the final error handler rather than Express's default HTML response.
  app.use(express.json({ limit: '16kb' }));
  const accounts = createAccountsService(createAccountsRepository(database));
  // Account routes own HTTP validation; services and repositories own policy/SQL.
  app.use('/api/v1/accounts', rememberRoutePrefix, createAccountsRouter(accounts));
  // Mount credit/debit writes and history under the same account prefix; the service owns
  // one checked-out client and atomic boundary for every ledger movement.
  app.use(
    '/api/v1/accounts',
    rememberRoutePrefix,
    createTransactionsRouter(createTransactionsService(database)),
  );
  // Transfer creation uses its own strict HTTP boundary and one two-account transaction.
  app.use(
    '/api/v1/transfers',
    rememberRoutePrefix,
    createTransfersRouter(createTransfersService(database)),
  );
  // Unmatched paths, including transaction editing/deletion, use JSON errors.
  app.use((_request, _response, next) => {
    next(new ApiError(404, 'ROUTE_NOT_FOUND', 'Route not found'));
  });
  // Error middleware must run last to handle parser, validation, and async failures.
  app.use(createErrorHandler(logger));
  return app;
}
