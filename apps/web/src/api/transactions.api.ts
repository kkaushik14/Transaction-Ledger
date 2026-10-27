/** Transaction writes and history reads remain HTTP-only and contract validated. */
import {
  createTransactionRequestSchema,
  createTransactionResponseSchema,
  transactionHistoryResponseSchema,
  type CreateTransactionRequest,
  type TransactionHistoryQuery,
} from '@ledger/contracts';
import { apiRequest } from './client';
/** Sends exactly one preserved intent; callers decide whether a failure is safe to retry. */
export function createTransaction(accountId: string, input: CreateTransactionRequest) {
  return apiRequest(
    `/accounts/${encodeURIComponent(accountId)}/transactions`,
    createTransactionResponseSchema,
    { method: 'POST', body: createTransactionRequestSchema.parse(input) },
  );
}
/** Serializes already-validated query values and cancels superseded history reads. */
export function getTransactionHistory(
  accountId: string,
  query: TransactionHistoryQuery,
  signal: AbortSignal,
) {
  const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) });
  if (query.type) params.set('type', query.type);
  return apiRequest(
    `/accounts/${encodeURIComponent(accountId)}/transactions?${params}`,
    transactionHistoryResponseSchema,
    { signal },
  );
}
