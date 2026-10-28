/** Review of one normalized immutable command; pending and retry views never reconstruct a new payload. */
import { useEffect, useId, useRef } from 'react';
import type { CreateTransferRequest } from '@ledger/contracts';
import { Button } from '../../../components/ui/index.js';
import styles from './transfers.module.css';
/** Presentational review contract; the feature hook owns all network and reference state. */
export interface TransferReviewProps {
  payload: CreateTransferRequest;
  onConfirm: () => void;
  onEdit?: (() => void) | undefined;
  pending?: boolean;
  showConfirm?: boolean;
  retry?: boolean;
  focusOnMount?: boolean;
}
/** Shows complete source/destination details and requires an explicit send or identical retry. */
export function TransferReview({
  payload,
  onConfirm,
  onEdit,
  pending = false,
  showConfirm = true,
  retry = false,
  focusOnMount = false,
}: TransferReviewProps) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) heading.current?.focus({ preventScroll: true });
  }, [focusOnMount]);
  return (
    <section aria-labelledby={id} className={styles.review}>
      <h3 id={id} ref={heading} tabIndex={-1}>
        Review transfer
      </h3>
      <dl className={styles.details}>
        <dt>From account</dt>
        <dd>
          <code>{payload.source_account_id}</code>
        </dd>
        <dt>To account</dt>
        <dd>
          <code>{payload.destination_account_id}</code>
        </dd>
        <dt>Amount</dt>
        <dd className={styles.money} data-long={payload.amount.length > 16}>
          {payload.amount}
        </dd>
        <dt>Description</dt>
        <dd>{payload.description || 'No description'}</dd>
        <dt>Reference</dt>
        <dd>
          <code>{payload.reference_id}</code>
        </dd>
      </dl>
      <p className={styles.note}>
        Check the destination ID and amount. Accepted transfers are permanent.
      </p>
      {showConfirm && (
        <Button onClick={onConfirm} loading={pending}>
          {pending ? 'Transferring…' : retry ? 'Retry same transfer' : 'Confirm transfer'}
        </Button>
      )}
      {onEdit && (
        <Button variant="subtle" disabled={pending} onClick={onEdit}>
          Edit transfer
        </Button>
      )}
    </section>
  );
}
