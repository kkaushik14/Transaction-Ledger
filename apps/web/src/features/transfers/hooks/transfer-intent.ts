/** Source-scoped unresolved transfer persistence; stores commands only, never authoritative balances. */
import { ApplicationError, reportError } from '../../../errors/index.js';
import { createTransferRequestSchema, type CreateTransferRequest } from '@ledger/contracts';
const key = (source: string) => `transaction-ledger:transfer-intent:${source.toLowerCase()}`;
/** Rejects corrupt commands and commands belonging to a different account. */
export function readTransferIntent(source: string): CreateTransferRequest | undefined {
  try {
    const raw = sessionStorage.getItem(key(source));
    if (!raw) return;
    const parsed = createTransferRequestSchema.safeParse(JSON.parse(raw));
    if (parsed.success && parsed.data.source_account_id === source.toLowerCase())
      return parsed.data;
    reportError(
      new ApplicationError('Invalid or cross-account saved command', 'STORAGE_UNAVAILABLE', 0, {
        cause: parsed.success ? new Error('Account identity mismatch') : parsed.error,
      }),
      'session.read',
    );
  } catch (error: unknown) {
    reportError(
      new ApplicationError('Session data could not be read', 'STORAGE_UNAVAILABLE', 0, {
        cause: error,
      }),
      'session.read',
    );
  }
}
/** Requires durable session storage before sending; a failed save must not silently weaken reload protection. */
export function saveTransferIntent(source: string, payload: CreateTransferRequest): boolean {
  try {
    sessionStorage.setItem(key(source), JSON.stringify(payload));
    if (JSON.stringify(readTransferIntent(source)) !== JSON.stringify(payload))
      throw new Error('Stored command did not match');
    return true;
  } catch (error: unknown) {
    throw new ApplicationError('Session command could not be saved', 'STORAGE_UNAVAILABLE', 0, {
      cause: error,
    });
  }
}
/** A delayed response may remove only its own reference, never a newer unresolved transfer. */
export function clearTransferIntent(source: string, reference: string): void {
  try {
    if (readTransferIntent(source)?.reference_id === reference)
      sessionStorage.removeItem(key(source));
  } catch (error: unknown) {
    reportError(
      new ApplicationError('Session command cleanup failed', 'STORAGE_UNAVAILABLE', 0, {
        cause: error,
      }),
      'session.cleanup',
    );
  }
}
