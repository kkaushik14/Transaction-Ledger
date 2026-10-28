/** Receipt contains committed server data only; balance values are snapshots after the transfer. */
import { useEffect, useId, useRef } from 'react';
import type { CreateTransferResponse } from '@ledger/contracts';
import { ButtonLink, StatusMessage } from '../../../components/ui/index.js';
import styles from './transfers.module.css';
/** Presents a confirmed transfer without claiming its returned balances remain current indefinitely. */
export function TransferReceipt({ result }: { result: CreateTransferResponse['data'] }) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  return (
    <section aria-labelledby={id} className={styles.review}>
      <h3 id={id} ref={heading} tabIndex={-1}>
        Transfer receipt
      </h3>
      <StatusMessage tone="success" title="Transfer complete">
        {result.transfer.amount} transferred. Both ledger entries were recorded.
      </StatusMessage>
      <dl className={styles.details}>
        <dt>From account</dt>
        <dd>
          <code>{result.transfer.source_account_id}</code>
        </dd>
        <dt>To account</dt>
        <dd>
          <code>{result.transfer.destination_account_id}</code>
        </dd>
        <dt>Transfer ID</dt>
        <dd>
          <code>{result.transfer.id}</code>
        </dd>
        <dt>Reference</dt>
        <dd>
          <code>{result.transfer.reference_id}</code>
        </dd>
        <dt>Source balance after transfer</dt>
        <dd className={styles.money} data-long={result.source_account_balance.length > 16}>
          {result.source_account_balance}
        </dd>
        <dt>Destination balance after transfer</dt>
        <dd className={styles.money} data-long={result.destination_account_balance.length > 16}>
          {result.destination_account_balance}
        </dd>
        <dt>Debit entry</dt>
        <dd>
          <code>{result.debit.id}</code>
        </dd>
        <dt>Credit entry</dt>
        <dd>
          <code>{result.credit.id}</code>
        </dd>
      </dl>
      <ButtonLink variant="secondary" to={`/accounts/${result.transfer.destination_account_id}`}>
        Open destination account
      </ButtonLink>
    </section>
  );
}
