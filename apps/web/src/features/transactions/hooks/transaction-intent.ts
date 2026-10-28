/** Session persistence protects uncertain write retries across navigation or refresh; balances are never cached. */
import { createTransactionRequestSchema, type CreateTransactionRequest } from '@ledger/contracts';
const key = (accountId: string) => `transaction-ledger:intent:${accountId.toLowerCase()}`;
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
/** Confirms persistence before writes so storage failure cannot silently remove reload retry protection. */
export function savePendingIntent(
  accountId: string,
  input: CreateTransactionRequest | undefined,
): boolean {
  try {
    if (input) sessionStorage.setItem(key(accountId), JSON.stringify(input));
    else sessionStorage.removeItem(key(accountId));
    return input ? JSON.stringify(readPendingIntent(accountId)) === JSON.stringify(input) : true;
  } catch {
    return false;
  }
}
/** Late responses from an unmounted form may clear only their own reference, never a newer intent. */
export function clearPendingIntent(accountId: string, referenceId: string): void {
  if (readPendingIntent(accountId)?.reference_id === referenceId) {
    savePendingIntent(accountId, undefined);
  }
}
