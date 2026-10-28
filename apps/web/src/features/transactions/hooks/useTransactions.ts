/** Filter/page orchestration resets pages on filter changes and ignores obsolete history reads. */
import { useCallback, useState } from 'react';
import { getTransactionHistory } from '../../../api/index.js';
import { useRemoteResource } from '../../../hooks/index.js';
/** UI filter vocabulary; All omits the API type parameter rather than inventing a server value. */
export type HistoryFilter = 'all' | 'credit' | 'debit';
/** Supplies server metadata and explicit filter/page/refresh actions for the history component. */
export function useTransactions(accountId: string) {
  const [query, setQuery] = useState<{ type: HistoryFilter; page: number }>({
    type: 'all',
    page: 1,
  });
  const load = useCallback(
    (signal: AbortSignal) =>
      getTransactionHistory(
        accountId,
        { page: query.page, limit: 20, ...(query.type === 'all' ? {} : { type: query.type }) },
        signal,
      ),
    [accountId, query.page, query.type],
  );
  const resource = useRemoteResource(`${accountId}:${query.type}:${query.page}`, load);
  return {
    ...resource,
    filter: query.type,
    page: query.page,
    changeFilter: (type: HistoryFilter) => setQuery({ type, page: 1 }),
    changePage: (page: number) => setQuery((current) => ({ ...current, page })),
    refreshAfterMutation: () => {
      setQuery((current) => ({ ...current, page: 1 }));
      resource.refresh();
    },
  };
}
