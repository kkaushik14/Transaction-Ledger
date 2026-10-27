/** Displays the exact API decimal string; no optimistic or floating-point balance math. */
import { balanceSchema } from '@ledger/contracts';
import { Icon } from '../../../components/ui/Icon';
import styles from './accounts.module.css';
/** Retains an existing authoritative balance during a refresh and labels that state clearly. */
export function AccountBalanceCard({
  balance,
  refreshing = false,
}: {
  balance: string;
  refreshing?: boolean;
}) {
  return (
    <section className={styles.balanceCard} aria-label="Account balance" aria-busy={refreshing}>
      <div className={styles.balanceTop}>
        <span>Current balance</span>
        <Icon name="ledger" />
      </div>
      <p className={styles.balance} data-long={balance.length > 16} data-testid="account-balance">
        {balanceSchema.parse(balance)}
      </p>
      <p className={styles.balanceFoot}>
        {refreshing ? 'Updating from the ledger…' : 'Server-verified balance · Single-unit ledger'}
      </p>
    </section>
  );
}
