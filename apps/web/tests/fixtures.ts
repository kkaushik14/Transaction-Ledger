/** Contract-valid browser test fixtures; no real account data or hosted credentials are used. */
import type { CreateTransactionResponse } from '@ledger/contracts';
export const accountId = '64c7dc4e-509c-460b-9175-c79503c4f4c5';
export const entryId = '256db272-a509-4e47-b8de-85e52d23829b';
export const accountResponse = {
  data: {
    id: accountId,
    name: 'Alex Morgan',
    balance: '0.00',
    created_at: '2026-10-28T00:00:00.000Z',
  },
};
export const transactionResponse: CreateTransactionResponse = {
  data: {
    transaction: {
      id: entryId,
      account_id: accountId,
      type: 'credit',
      amount: '1.50',
      description: '',
      reference_id: 'test-ref',
      created_at: '2026-10-28T00:00:00.000Z',
    },
    account_balance: '1.50',
  },
};
/** Returns a real Fetch Response so parsing/error behavior is exercised, not bypassed. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
