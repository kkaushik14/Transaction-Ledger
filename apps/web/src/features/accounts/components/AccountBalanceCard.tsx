/** Displays the exact API decimal string; no optimistic or floating-point balance math. */
import { balanceSchema } from '@ledger/contracts';
import { Icon, Spinner } from '../../../components/ui/index.js';
import styles from './accounts.module.css';
/** Retains an existing authoritative balance during a refresh and labels that state clearly. */
export function AccountBalanceCard({
  balance,
  refreshing = false,
  stale = false,
}: {
  balance: string;
  refreshing?: boolean;
  stale?: boolean;
}) {
  return (
    <section className={styles.balanceCard} aria-label="Account balance" aria-busy={refreshing}>
      <div className={styles.balanceTop}>
        <span>{stale ? 'Last confirmed balance' : 'Current balance'}</span>
        <Icon name="ledger" />
      </div>
      <p className={styles.balance} data-long={balance.length > 16} data-testid="account-balance">
        {balanceSchema.parse(balance)}
      </p>
      <p className={styles.balanceFoot}>
        {refreshing && <Spinner />}
        {refreshing
          ? 'Updating from the ledger…'
          : stale
            ? 'Refresh failed · Retry to get the latest balance'
            : 'Server-verified balance · Single-unit ledger'}
      </p>
    </section>
  );
}
