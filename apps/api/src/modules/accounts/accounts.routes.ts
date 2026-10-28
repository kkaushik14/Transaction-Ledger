/** Registers account creation and balance reads with server-authoritative input validation. */
import { Router } from 'express';
import { accountIdParamsSchema, createAccountRequestSchema } from '@ledger/contracts';
import { requireJson, validate } from '../../middleware/index.js';
import { createAccountsController } from './accounts.controller.js';
import type { AccountsService } from './accounts.service.js';

/** Builds routes relative to /api/v1/accounts; no SQL runs in route registration. */
export function createAccountsRouter(service: AccountsService): Router {
  const router = Router();
  const controller = createAccountsController(service);
  // POST /api/v1/accounts: require JSON, reject server-owned/unknown fields,
  // and normalize the name before the controller can request a database insert.
  router.post('/', requireJson, validate(createAccountRequestSchema, 'body'), controller.create);
  // GET /api/v1/accounts/:accountId/balance: validate the UUID before querying.
  router.get('/:accountId/balance', validate(accountIdParamsSchema, 'params'), controller.balance);
  return router;
}
