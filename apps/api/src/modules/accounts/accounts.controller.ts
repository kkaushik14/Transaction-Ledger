/** HTTP adapters for account use cases; input parsing runs in route middleware. */
import type { RequestHandler } from 'express';
import type {
  CreateAccountRequest,
  CreateAccountResponse,
  AccountBalanceResponse,
} from '@ledger/contracts';
import type { AccountsService } from './accounts.service.js';

/** Typed controller signatures for the two implemented account routes. */
export interface AccountsController {
  create: RequestHandler<Record<string, never>, CreateAccountResponse, CreateAccountRequest>;
  balance: RequestHandler<{ accountId: string }, AccountBalanceResponse>;
}

/** Adapts validated HTTP inputs to services; Express 5 forwards rejected promises centrally. */
export function createAccountsController(service: AccountsService): AccountsController {
  return {
    async create(request, response) {
      const account = await service.create(request.body);
      response.status(201).json({ data: account });
    },
    async balance(request, response) {
      const balance = await service.getBalance(request.params.accountId);
      response.status(200).json({ data: balance });
    },
  };
}
