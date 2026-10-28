/** Account identity and clipboard feedback; unknown names use the approved Account/UUID fallback. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, IconButton, ErrorNotice } from '../../../components/ui/index.js';

import { ApplicationError, reportError, runSafely } from '../../../errors/index.js';
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
  const [error, setError] = useState<ApplicationError>();
  async function copy() {
    setError(undefined);
    setCopied('');
    try {
      await navigator.clipboard.writeText(accountId);
      setCopied('Account ID copied.');
    } catch (error: unknown) {
      setError(
        reportError(
          new ApplicationError('Clipboard copy failed', 'CLIPBOARD_UNAVAILABLE', 0, {
            cause: error,
          }),
          'clipboard.copy',
        ),
      );
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
              onClick={() => runSafely(copy, 'clipboard.callback')}
            />
          </div>
          <span role="status" className={styles.uuid}>
            {copied}
          </span>
        </div>
        {error && <ErrorNotice error={error} onRetry={copy} />}
        <span className={styles.demoBadge}>
          <Icon name="ledger" />
          Ledger workspace
        </span>
      </div>
    </>
  );
}
