/** Presentational continuation card for the selected account; no account or money requests run here. */
import { ButtonLink } from '../../../components/ui/index.js';
import type { ActiveAccount } from '../hooks/index.js';
import styles from './accounts.module.css';
/** Keeps saved navigation identity readable at narrow widths, including long account names. */
export function ActiveAccountCard({ account }: { account: ActiveAccount }) {
  return (
    <div className={`stack ${styles.selectedAccount}`}>
      <h3>Your account is ready</h3>
      <p>{account.name ?? 'Account'}</p>
      <p>
        Account ID: <span className={styles.uuid}>{account.id}</span>
      </p>
      <ButtonLink to={`/accounts/${account.id}`}>My account</ButtonLink>
      <p>
        Log out to clear this browser’s selection. Use your Account ID to return; your ledger is
        kept.
      </p>
    </div>
  );
}
