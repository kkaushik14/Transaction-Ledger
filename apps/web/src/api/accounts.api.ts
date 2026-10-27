/** Account HTTP adapters use shared contracts and never expose database access to React. */
import {
  createAccountRequestSchema,
  createAccountResponseSchema,
  accountBalanceResponseSchema,
  type CreateAccountRequest,
} from '@ledger/contracts';
import { apiRequest } from './client';
/** Creates a name-only account; IDs/time/zero balance remain database-owned. */
export function createAccount(input: CreateAccountRequest) {
  return apiRequest('/accounts', createAccountResponseSchema, {
    method: 'POST',
    body: createAccountRequestSchema.parse(input),
  });
}
/** Reads a server-authoritative balance; cancellation discards obsolete account requests. */
export function getAccountBalance(accountId: string, signal: AbortSignal) {
  return apiRequest(
    `/accounts/${encodeURIComponent(accountId)}/balance`,
    accountBalanceResponseSchema,
    { signal },
  );
}
