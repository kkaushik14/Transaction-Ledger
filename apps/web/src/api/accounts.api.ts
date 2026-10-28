/** Account HTTP adapters use shared contracts and never expose database access to React. */
import {
  createAccountRequestSchema,
  createAccountResponseSchema,
  accountBalanceResponseSchema,
  type CreateAccountRequest,
} from '@ledger/contracts';
import { apiRequest, ApiClientError } from './client';
/** Creates a name-only account; IDs/time/zero balance remain database-owned. */
export function createAccount(input: CreateAccountRequest) {
  return apiRequest('/accounts', createAccountResponseSchema, {
    method: 'POST',
    body: createAccountRequestSchema.parse(input),
  });
}
/** Reads a server-authoritative balance; cancellation discards obsolete account requests. */
export async function getAccountBalance(accountId: string, signal: AbortSignal) {
  const response = await apiRequest(
    `/accounts/${encodeURIComponent(accountId)}/balance`,
    accountBalanceResponseSchema,
    { signal },
  );
  if (response.data.account_id.toLowerCase() !== accountId.toLowerCase()) {
    throw new ApiClientError(
      'The balance response belongs to a different account. Retry to confirm this account.',
      'INVALID_RESPONSE',
    );
  }
  return response;
}
