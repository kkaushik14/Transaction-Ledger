/** Account identity and clipboard feedback; unknown names use the approved Account/UUID fallback. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../../components/ui/Icon';
import { IconButton } from '../../../components/ui/IconButton';
import styles from './accounts.module.css';
/** Uses only a genuinely known name; copy failure leaves the full selectable UUID visible. */
export function AccountPageHeader({
  accountId,
  name,
}: {
  accountId: string;
  name?: string | undefined;
}) {
  const [copied, setCopied] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(accountId);
      setCopied('Account ID copied.');
    } catch {
      setCopied('Could not copy. Select the account ID to copy it manually.');
    }
  }
  return (
    <>
      <Link className={styles.breadcrumb} to="/#get-started">
        <Icon name="chevronLeft" />
        Back to account entry
      </Link>
      <div className={styles.accountHeader}>
        <div className={styles.identity}>
          <h1>{name ?? 'Account'}</h1>
          <div className={styles.idLine}>
            <span className={styles.uuid}>{accountId}</span>
            <IconButton
              label="Copy account ID"
              icon="copy"
              variant="subtle"
              onClick={() => void copy()}
            />
          </div>
          <span role="status" className={styles.uuid}>
            {copied}
          </span>
        </div>
        <span className={styles.demoBadge}>
          <Icon name="ledger" />
          Ledger workspace
        </span>
      </div>
    </>
  );
}
