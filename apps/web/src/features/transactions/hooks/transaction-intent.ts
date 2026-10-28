/** Session persistence protects uncertain write retries across navigation or refresh; balances are never cached. */
import { ApplicationError, reportError } from '../../../errors/index.js';
import { createTransactionRequestSchema, type CreateTransactionRequest } from '@ledger/contracts';
const key = (accountId: string) => `transaction-ledger:intent:${accountId.toLowerCase()}`;
/** Reads only a valid preserved request; malformed/stale browser data is ignored. */
export function readPendingIntent(accountId: string): CreateTransactionRequest | undefined {
  try {
    const raw = sessionStorage.getItem(key(accountId));
    if (!raw) return;
    const parsed = createTransactionRequestSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
    reportError(
      new ApplicationError('Invalid saved command', 'STORAGE_UNAVAILABLE', 0, {
        cause: parsed.error,
      }),
      'session.read',
    );
    return;
  } catch (error: unknown) {
    reportError(
      new ApplicationError('Session data could not be read', 'STORAGE_UNAVAILABLE', 0, {
        cause: error,
      }),
      'session.read',
    );
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
    if (input && JSON.stringify(readPendingIntent(accountId)) !== JSON.stringify(input))
      throw new Error('Stored command did not match');
    return true;
  } catch (error: unknown) {
    throw new ApplicationError('Session command could not be saved', 'STORAGE_UNAVAILABLE', 0, {
      cause: error,
    });
  }
}
/** Late responses from an unmounted form may clear only their own reference, never a newer intent. */
export function clearPendingIntent(accountId: string, referenceId: string): void {
  if (readPendingIntent(accountId)?.reference_id === referenceId) {
    try {
      savePendingIntent(accountId, undefined);
    } catch (error: unknown) {
      reportError(error, 'session.cleanup');
    }
  }
}
