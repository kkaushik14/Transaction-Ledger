/** Responsive history view preserves every entry field, filters, and server pagination metadata. */
import { useRef } from 'react';
import type { TransactionHistoryResponse } from '@ledger/contracts';
import type { HistoryFilter } from '../hooks/index.js';
import {
  SelectField,
  LoadingState,
  StatusMessage,
  Pagination,
  Button,
  Icon,
} from '../../../components/ui/index.js';

import styles from './transactions.module.css';
/** Formats server UTC times for display only; never reorders the server's latest-first rows. */
function displayTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
/** Complete view inputs keep fetching/orchestration in feature hooks rather than tables or cards. */
export interface TransactionHistoryProps {
  data: TransactionHistoryResponse | undefined;
  loading: boolean;
  error: string | undefined;
  filter: HistoryFilter;
  onFilter: (filter: HistoryFilter) => void;
  onPage: (page: number) => void;
  onRetry: () => void;
}
/** Uses a wide-screen semantic table and a narrow-screen card list without hiding required details. */
export function TransactionHistory({
  data,
  loading,
  error,
  filter,
  onFilter,
  onPage,
  onRetry,
}: TransactionHistoryProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  function changePage(page: number) {
    onPage(page);
    heading.current?.scrollIntoView({ block: 'start' });
    heading.current?.focus({ preventScroll: true });
  }
  return (
    <section className={styles.history} aria-labelledby="history-title" aria-busy={loading}>
      <div className={styles.historyHeader}>
        <div className={styles.historyHeading}>
          <h2 ref={heading} id="history-title" tabIndex={-1}>
            Transaction history
          </h2>
          <p>Your record, latest first.</p>
        </div>
        <SelectField
          label="Filter by type"
          value={filter}
          onChange={(event) =>
            onFilter(
              event.target.value === 'credit'
                ? 'credit'
                : event.target.value === 'debit'
                  ? 'debit'
                  : 'all',
            )
          }
        >
          <option value="all">All transactions</option>
          <option value="credit">Credits</option>
          <option value="debit">Debits</option>
        </SelectField>
      </div>
      {error ? (
        <div className="stack">
          <StatusMessage tone="error">{error}</StatusMessage>
          <Button variant="secondary" onClick={onRetry}>
            Retry history
          </Button>
        </div>
      ) : loading ? (
        <LoadingState label="Loading transaction history…" />
      ) : (
        data && (
          <>
            {data.data.length === 0 ? (
              <div className={styles.empty}>
                <Icon name="ledger" />
                <strong>
                  {filter === 'all' ? 'No transactions yet' : 'No matching transactions'}
                </strong>
                <p>
                  {filter === 'all'
                    ? 'Your first credit or debit will appear here.'
                    : 'Try another filter to see more of your ledger.'}
                </p>
              </div>
            ) : (
              <>
                <div className="history-table">
                  <table className={styles.table}>
                    <caption className="sr-only">Latest-first transaction history</caption>
                    <thead>
                      <tr>
                        <th scope="col">Date & time</th>
                        <th scope="col">Type</th>
                        <th scope="col">Amount</th>
                        <th scope="col">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.map((row) => (
                        <tr key={row.id}>
                          <td className={styles.date}>
                            <time dateTime={row.created_at}>{displayTime(row.created_at)}</time>
                          </td>
                          <td>
                            <span className={styles.badge}>
                              <Icon name={row.type === 'credit' ? 'plus' : 'minus'} />
                              {row.type === 'credit' ? 'Credit' : 'Debit'}
                            </span>
                          </td>
                          <td className={styles.amount} data-long={row.amount.length > 16}>
                            {row.type === 'credit' ? '+' : '−'}
                            {row.amount}
                          </td>
                          <td>
                            {row.description || 'No description'}
                            <span className={styles.meta}>
                              Reference <code>{row.reference_id}</code>
                            </span>
                            <span className={styles.meta}>
                              Entry ID <code>{row.id}</code>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="history-cards" role="list" aria-label="Transaction entries">
                  {data.data.map((row) => (
                    <article key={row.id} className={styles.mobileCard} role="listitem">
                      <div className={styles.mobileTop}>
                        <span className={styles.badge}>
                          <Icon name={row.type === 'credit' ? 'plus' : 'minus'} />
                          {row.type === 'credit' ? 'Credit' : 'Debit'}
                        </span>
                        <span className={styles.amount} data-long={row.amount.length > 16}>
                          {row.type === 'credit' ? '+' : '−'}
                          {row.amount}
                        </span>
                      </div>
                      <dl>
                        <dt>Date</dt>
                        <dd>
                          <time dateTime={row.created_at}>{displayTime(row.created_at)}</time>
                        </dd>
                        <dt>Description</dt>
                        <dd>{row.description || 'No description'}</dd>
                        <dt>Reference</dt>
                        <dd>
                          <code>{row.reference_id}</code>
                        </dd>
                        <dt>Entry ID</dt>
                        <dd>
                          <code>{row.id}</code>
                        </dd>
                      </dl>
                    </article>
                  ))}
                </div>
              </>
            )}
            <Pagination
              {...{
                page: data.pagination.page,
                totalPages: data.pagination.total_pages,
                totalRecords: data.pagination.total_records,
                onPageChange: changePage,
                loading,
              }}
            />
          </>
        )
      )}
    </section>
  );
}
