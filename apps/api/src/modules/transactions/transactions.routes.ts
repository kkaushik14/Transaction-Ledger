/** Registers credit/debit writes and validated history reads; edit/delete routes remain absent. */
import { Router } from 'express';
import {
  accountIdParamsSchema,
  createTransactionRequestSchema,
  transactionHistoryQuerySchema,
} from '@ledger/contracts';
import { requireJson, validate, validateQuery } from '../../middleware/validate.js';
import {
  createTransactionController,
  createTransactionHistoryController,
} from './transactions.controller.js';
import type { TransactionsService } from './transactions.service.js';

/** Builds account-scoped transaction routes relative to /api/v1/accounts. */
export function createTransactionsRouter(service: TransactionsService): Router {
  const router = Router();
  // Validate UUID, media type, and strict body before acquiring any database client.
  // Transaction edit/delete routes remain intentionally absent.
  router.post(
    '/:accountId/transactions',
    validate(accountIdParamsSchema, 'params'),
    requireJson,
    validate(createTransactionRequestSchema, 'body'),
    createTransactionController(service),
  );
  // GET uses parsed query locals so defaults/coercion run before a client is
  // acquired, without assigning to the Express 5 read-only request.query getter.
  router.get(
    '/:accountId/transactions',
    validate(accountIdParamsSchema, 'params'),
    validateQuery(transactionHistoryQuerySchema),
    createTransactionHistoryController(service),
  );
  return router;
}
