/** Component-first transfer workflow composes existing controls, independent review and confirmed receipt. */
import { useRef, useState, type FormEvent } from 'react';
import { createTransferRequestSchema } from '@ledger/contracts';
import {
  Button,
  Icon,
  StatusMessage,
  TextField,
  TextAreaField,
} from '../../../components/ui/index.js';
import { useTransferIntent } from '../hooks/index.js';
import { TransferReview } from './TransferReview';
import { TransferReceipt } from './TransferReceipt';
import styles from './transfers.module.css';
/** The current route fixes the source; the existing backend is authoritative for funds and destination existence. */
export function TransferForm({
  sourceAccountId,
  onChanged,
}: {
  sourceAccountId: string;
  onChanged: () => void;
}) {
  const intent = useTransferIntent(sourceAccountId, onChanged);
  const [destination, setDestination] = useState(intent.payload?.destination_account_id ?? '');
  const [amount, setAmount] = useState(intent.payload?.amount ?? '');
  const [description, setDescription] = useState(intent.payload?.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reviewedConflict, setReviewedConflict] = useState(false);
  const destinationRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  function focusDestination() {
    requestAnimationFrame(() => destinationRef.current?.focus());
  }
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (intent.phase !== 'editing') return;
    const parsed = createTransferRequestSchema.safeParse({
      source_account_id: sourceAccountId,
      destination_account_id: destination.trim(),
      amount,
      description,
      reference_id: crypto.randomUUID(),
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]);
        next[field] =
          field === 'destination_account_id' && issue.code === 'invalid_format'
            ? 'Enter a valid destination Account ID.'
            : issue.message;
      }
      setErrors(next);
      (next.destination_account_id
        ? destinationRef
        : next.amount
          ? amountRef
          : descriptionRef
      ).current?.focus();
      return;
    }
    setErrors({});
    intent.review(parsed.data);
  }
  function newTransfer() {
    intent.reset();
    setAmount('');
    setDescription('');
    setDestination('');
    setErrors({});
    setReviewedConflict(false);
    focusDestination();
  }
  return (
    <form
      noValidate
      aria-label="Transfer between accounts"
      className={styles.form}
      onSubmit={review}
    >
      <div className={styles.intro}>
        <h2>Transfer between accounts</h2>
        <p>Move funds from this account to another account.</p>
      </div>
      {intent.phase === 'editing' && (
        <>
          <dl className={styles.details}>
            <dt>From this account</dt>
            <dd>
              <code>{sourceAccountId}</code>
            </dd>
          </dl>
          <TextField
            ref={destinationRef}
            label="Destination account ID"
            name="destination_account_id"
            value={destination}
            required
            autoComplete="off"
            placeholder="Paste the destination Account ID"
            error={errors.destination_account_id}
            onChange={(event) => {
              setDestination(event.target.value);
              setErrors({});
            }}
          />
          <TextField
            ref={amountRef}
            label="Transfer amount"
            name="transfer_amount"
            value={amount}
            required
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            hint="Positive amount · Up to 2 decimal places"
            error={errors.amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setErrors({});
            }}
          />
          <TextAreaField
            ref={descriptionRef}
            label="Transfer description (optional)"
            name="transfer_description"
            value={description}
            error={errors.description}
            onChange={(event) => {
              setDescription(event.target.value);
              setErrors({});
            }}
          />
          <Button type="submit">
            Review transfer <Icon name="arrow" />
          </Button>
        </>
      )}
      {intent.message && (
        <StatusMessage
          tone="error"
          title={
            intent.phase === 'uncertain'
              ? 'Transfer result unconfirmed'
              : intent.phase === 'conflict'
                ? 'Transfer reference already used'
                : ''
          }
        >
          {intent.message}
        </StatusMessage>
      )}
      {intent.payload && ['reviewing', 'submitting', 'uncertain'].includes(intent.phase) && (
        <TransferReview
          payload={intent.payload}
          onConfirm={() => void intent.send()}
          onEdit={
            intent.phase === 'reviewing'
              ? () => {
                  intent.edit();
                  focusDestination();
                }
              : undefined
          }
          pending={intent.phase === 'submitting'}
          retry={intent.phase === 'uncertain'}
          focusOnMount={intent.phase === 'reviewing'}
        />
      )}
      {intent.phase === 'uncertain' && (
        <>
          <p className={styles.note}>
            A timeout does not mean the transfer failed. Retry keeps the original destination,
            amount and reference.
          </p>
          <Button variant="secondary" onClick={onChanged}>
            Refresh account
          </Button>
        </>
      )}
      {intent.phase === 'conflict' && (
        <>
          <dl className={styles.details}>
            <dt>Preserved reference</dt>
            <dd>
              <code>{intent.payload?.reference_id}</code>
            </dd>
          </dl>
          <Button variant="secondary" onClick={onChanged}>
            Refresh account
          </Button>
          <label className={styles.acknowledge}>
            <input
              type="checkbox"
              checked={reviewedConflict}
              onChange={(event) => setReviewedConflict(event.target.checked)}
            />
            I reviewed the balance and history. A new transfer could move funds again.
          </label>
          <Button variant="secondary" disabled={!reviewedConflict} onClick={newTransfer}>
            New transfer
          </Button>
        </>
      )}
      {intent.phase === 'success' && intent.result && (
        <>
          <TransferReceipt result={intent.result} />
          <Button variant="secondary" onClick={newTransfer}>
            New transfer
          </Button>
        </>
      )}
    </form>
  );
}
