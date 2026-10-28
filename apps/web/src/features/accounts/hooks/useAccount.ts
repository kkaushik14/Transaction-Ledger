/** Account reads are driven by the route identity; no balance arithmetic or local balance cache. */
import { useCallback } from 'react';
import { getAccountBalance } from '../../../api/index.js';
import { useRemoteResource } from '../../../hooks/index.js';
/** Loads/refetches the selected account's authoritative balance. */
export function useAccount(accountId: string) {
  const load = useCallback(
    (signal: AbortSignal) => getAccountBalance(accountId, signal),
    [accountId],
  );
  return useRemoteResource(accountId, load);
}
