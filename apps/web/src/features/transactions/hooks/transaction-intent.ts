/** Session persistence protects uncertain write retries across navigation or refresh; balances are never cached. */
import { createTransactionRequestSchema, type CreateTransactionRequest } from '@ledger/contracts';
const key = (accountId: string) => `transaction-ledger:intent:${accountId}`;
/** Reads only a valid preserved request; malformed/stale browser data is ignored. */
export function readPendingIntent(accountId: string): CreateTransactionRequest | undefined {
  try {
    const raw = sessionStorage.getItem(key(accountId));
    if (!raw) return;
    const parsed = createTransactionRequestSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return;
  }
}
/** Stores/removes an intent without making browser storage availability a prerequisite for the ledger. */
export function savePendingIntent(
  accountId: string,
  input: CreateTransactionRequest | undefined,
): void {
  try {
    if (input) sessionStorage.setItem(key(accountId), JSON.stringify(input));
    else sessionStorage.removeItem(key(accountId));
  } catch {
    /* Private browsing/storage restrictions leave in-memory retry protection intact. */
  }
}
/** Late responses from an unmounted form may clear only their own reference, never a newer intent. */
export function clearPendingIntent(accountId: string, referenceId: string): void {
  if (readPendingIntent(accountId)?.reference_id === referenceId) {
    savePendingIntent(accountId, undefined);
  }
}
