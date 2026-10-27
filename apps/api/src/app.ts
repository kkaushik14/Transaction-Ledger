/** Composes account, credit/debit, and history HTTP routes with validation, restricted CORS, and safe centralized errors. */
import express, { type Express } from 'express';
import cors from 'cors';
import type { Pool } from 'pg';
import { createTransactionsRouter } from './modules/transactions/transactions.routes.js';
import { createTransactionsService } from './modules/transactions/transactions.service.js';
import { ApiError } from './errors/api-error.js';
import { errorHandler } from './middleware/error-handler.js';
import { createAccountsRouter } from './modules/accounts/accounts.routes.js';
import {
  createAccountsRepository,
  type AccountDatabase,
} from './modules/accounts/accounts.repository.js';
import { createAccountsService } from './modules/accounts/accounts.service.js';

/** Supplies explicit infrastructure; application creation never reads environment secrets. */
export interface AppDependencies {
  database: AccountDatabase & Pick<Pool, 'connect'>;
  webOrigin: string;
}

/** Builds an isolated account/transaction API, leaving pool ownership and shutdown to startup. */
export function createApp({ database, webOrigin }: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  // All paths receive the configured browser origin, including parse/error responses.
  // CORS precedes parsing and routing so preflight requests do not invoke domain code.
  app.use(
    cors({
      origin: webOrigin,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
    }),
  );
  // Parse bounded JSON before body validation; malformed/oversized requests reach
  // the final error handler rather than Express's default HTML response.
  app.use(express.json({ limit: '16kb' }));
  const accounts = createAccountsService(createAccountsRepository(database));
  // Account routes own HTTP validation; services and repositories own policy/SQL.
  app.use('/api/v1/accounts', createAccountsRouter(accounts));
  // Mount credit/debit writes and history under the same account prefix; the service owns
  // one checked-out client and atomic boundary for every ledger movement.
  app.use('/api/v1/accounts', createTransactionsRouter(createTransactionsService(database)));
  // Unmatched paths, including transaction editing/deletion, use JSON errors.
  app.use((_request, _response, next) => {
    next(new ApiError(404, 'ROUTE_NOT_FOUND', 'Route not found'));
  });
  // Error middleware must run last to handle parser, validation, and async failures.
  app.use(errorHandler);
  return app;
}
