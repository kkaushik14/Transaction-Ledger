/** Transaction writes and history reads remain HTTP-only and contract validated. */
import {
  createTransactionRequestSchema,
  createTransactionResponseSchema,
  transactionHistoryResponseSchema,
  type CreateTransactionRequest,
  type TransactionHistoryQuery,
} from '@ledger/contracts';
import { apiRequest, ApiClientError } from './client';
/** Sends exactly one preserved intent; callers decide whether a failure is safe to retry. */
export async function createTransaction(accountId: string, input: CreateTransactionRequest) {
  const command = createTransactionRequestSchema.parse(input);
  const response = await apiRequest(
    `/accounts/${encodeURIComponent(accountId)}/transactions`,
    createTransactionResponseSchema,
    { method: 'POST', body: command },
  );
  const entry = response.data.transaction;
  // A valid DTO for another intent must never become this account's success receipt.
  if (
    entry.account_id.toLowerCase() !== accountId.toLowerCase() ||
    entry.type !== command.type ||
    entry.amount !== command.amount ||
    entry.reference_id !== command.reference_id ||
    entry.description !== command.description
  ) {
    throw new ApiClientError(
      'The transaction response did not match your request. Review the account before retrying.',
      'INVALID_RESPONSE',
    );
  }
  return response;
}
/** Serializes already-validated query values and cancels superseded history reads. */
export async function getTransactionHistory(
  accountId: string,
  query: TransactionHistoryQuery,
  signal: AbortSignal,
) {
  const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) });
  if (query.type) params.set('type', query.type);
  const response = await apiRequest(
    `/accounts/${encodeURIComponent(accountId)}/transactions?${params}`,
    transactionHistoryResponseSchema,
    { signal },
  );
  if (
    response.pagination.page !== query.page ||
    response.pagination.limit !== query.limit ||
    response.data.some(
      (entry) =>
        entry.account_id.toLowerCase() !== accountId.toLowerCase() ||
        (query.type && entry.type !== query.type),
    )
  ) {
    throw new ApiClientError(
      'The history response did not match the selected account, filter or page. Retry history.',
      'INVALID_RESPONSE',
    );
  }
  return response;
}
