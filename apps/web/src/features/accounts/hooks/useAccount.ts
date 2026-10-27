/** Account reads are driven by the route identity; no balance arithmetic or local balance cache. */
import { useCallback } from 'react';
import { getAccountBalance } from '../../../api/accounts.api';
import { useRemoteResource } from '../../../hooks/useRemoteResource';
/** Loads/refetches the selected account's authoritative balance. */
export function useAccount(accountId: string) {
  const load = useCallback(
    (signal: AbortSignal) => getAccountBalance(accountId, signal),
    [accountId],
  );
  return useRemoteResource(accountId, load);
}
