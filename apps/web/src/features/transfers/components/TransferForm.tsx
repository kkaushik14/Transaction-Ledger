/** Component-first transfer workflow composes existing controls, independent review and confirmed receipt. */
import { useRef, useState, type FormEvent } from 'react';
import { createTransferRequestSchema } from '@ledger/contracts';
import {
  Button,
  Icon,
  ErrorNotice,
  TextField,
  TextAreaField,
} from '../../../components/ui/index.js';
import { useTransferIntent } from '../hooks/index.js';
import { TransferReview } from './TransferReview';
import { TransferReceipt } from './TransferReceipt';
import { ApplicationError, validationError, runSafely } from '../../../errors/index.js';
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
  const [validation, setValidation] = useState<ApplicationError>();
  function clearErrors() {
    setErrors({});
    setValidation(undefined);
    intent.dismissError();
  }
  function focusInvalid() {
    (errors.destination_account_id
      ? destinationRef
      : errors.amount
        ? amountRef
        : descriptionRef
    ).current?.focus();
  }
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
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = 'invalid';
      setValidation(validationError(parsed.error.issues));
      setErrors(next);
      (next.destination_account_id
        ? destinationRef
        : next.amount
          ? amountRef
          : descriptionRef
      ).current?.focus();
      return;
    }
    clearErrors();
    intent.review(parsed.data);
  }
  function newTransfer() {
    intent.reset();
    setAmount('');
    setDescription('');
    setDestination('');
    clearErrors();
    setReviewedConflict(false);
    focusDestination();
  }
  return (
    <form
      noValidate
      aria-label="Transfer between accounts"
      className={styles.form}
      onSubmit={(event) => runSafely(() => review(event), 'transfer.review')}
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
            aria-invalid={Boolean(errors.destination_account_id) || undefined}
            aria-describedby={validation ? 'transfer-error' : undefined}
            onChange={(event) => {
              setDestination(event.target.value);
              clearErrors();
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
            aria-invalid={Boolean(errors.amount) || undefined}
            aria-describedby={validation ? 'transfer-error' : undefined}
            onChange={(event) => {
              setAmount(event.target.value);
              clearErrors();
            }}
          />
          <TextAreaField
            ref={descriptionRef}
            label="Transfer description (optional)"
            name="transfer_description"
            value={description}
            aria-invalid={Boolean(errors.description) || undefined}
            aria-describedby={validation ? 'transfer-error' : undefined}
            onChange={(event) => {
              setDescription(event.target.value);
              clearErrors();
            }}
          />
          <Button type="submit">
            Review transfer <Icon name="arrow" />
          </Button>
        </>
      )}
      {(validation ?? intent.error) && (
        <ErrorNotice
          id="transfer-error"
          error={(validation ?? intent.error)!}
          context="transfer"
          uncertain={intent.phase === 'uncertain'}
          onRetry={intent.send}
          onReview={onChanged}
          onFixInput={() => {
            if (validation) focusInvalid();
            else if (intent.error?.code === 'ACCOUNT_NOT_FOUND') destinationRef.current?.focus();
            else amountRef.current?.focus();
          }}
        />
      )}
      {intent.payload && ['reviewing', 'submitting', 'uncertain'].includes(intent.phase) && (
        <TransferReview
          payload={intent.payload}
          onConfirm={() => runSafely(intent.send, 'transfer.confirm')}
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
          showConfirm={intent.phase !== 'uncertain' && !intent.error}
          focusOnMount={intent.phase === 'reviewing'}
        />
      )}
      {intent.phase === 'conflict' && (
        <>
          <dl className={styles.details}>
            <dt>Preserved reference</dt>
            <dd>
              <code>{intent.payload?.reference_id}</code>
            </dd>
          </dl>
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
