/** Source-scoped unresolved transfer persistence; stores commands only, never authoritative balances. */
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
  } catch {
    /* Unavailable storage cannot start or replay an HTTP request. */
  }
}
/** Requires durable session storage before sending; a failed save must not silently weaken reload protection. */
export function saveTransferIntent(source: string, payload: CreateTransferRequest): boolean {
  try {
    sessionStorage.setItem(key(source), JSON.stringify(payload));
    return JSON.stringify(readTransferIntent(source)) === JSON.stringify(payload);
  } catch {
    return false;
  }
}
/** A delayed response may remove only its own reference, never a newer unresolved transfer. */
export function clearTransferIntent(source: string, reference: string): void {
  try {
    if (readTransferIntent(source)?.reference_id === reference)
      sessionStorage.removeItem(key(source));
  } catch {
    /* A stale preserved reference remains safe to retry; it cannot create a second movement. */
  }
}
