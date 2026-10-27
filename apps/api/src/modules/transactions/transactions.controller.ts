/** Credit/debit and history HTTP adapters; middleware parses input and services own database work. */
import type { Request, RequestHandler } from 'express';
import type {
  CreateTransactionRequest,
  CreateTransactionResponse,
  TransactionHistoryQuery,
  TransactionHistoryResponse,
} from '@ledger/contracts';
import type { TransactionsService } from './transactions.service.js';

/** Returns a typed handler; Express 5 forwards service rejections to the central error middleware. */
export function createTransactionController(
  service: TransactionsService,
): RequestHandler<{ accountId: string }, CreateTransactionResponse, CreateTransactionRequest> {
  return async (request, response) => {
    const result = await service.create(request.params.accountId, request.body);
    response.status(201).json({ data: result });
  };
}

/** Returns history using the middleware's normalized query; never parses URL values as money. */
export function createTransactionHistoryController(
  service: TransactionsService,
): RequestHandler<
  { accountId: string },
  TransactionHistoryResponse,
  unknown,
  Request['query'],
  { query: TransactionHistoryQuery }
> {
  return async (request, response) => {
    const result = await service.getHistory(request.params.accountId, response.locals.query);
    response.status(200).json(result);
  };
}
