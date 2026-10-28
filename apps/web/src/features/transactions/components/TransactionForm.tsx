/** Credit/debit form validates decimal strings and preserves payload/reference for uncertain retries. */
import { useRef, useState, type FormEvent } from 'react';
import { createTransactionRequestSchema } from '@ledger/contracts';
import {
  Button,
  SelectField,
  TextField,
  TextAreaField,
  StatusMessage,
  ErrorNotice,
  Icon,
} from '../../../components/ui/index.js';

import { useTransactionIntent } from '../hooks/index.js';
import { ApplicationError, validationError, runSafely } from '../../../errors/index.js';
import styles from './transactions.module.css';
/** Exposes no mutable ID/timestamp/balance controls; the backend remains authoritative. */
export function TransactionForm({
  accountId,
  onChanged,
}: {
  accountId: string;
  onChanged: () => void;
}) {
  const intent = useTransactionIntent(accountId, onChanged);
  const [type, setType] = useState<'credit' | 'debit'>(intent.payload?.type ?? 'credit');
  const [amount, setAmount] = useState(intent.payload?.amount ?? '');
  const [description, setDescription] = useState(intent.payload?.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const amountRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [validation, setValidation] = useState<ApplicationError>();
  function clearErrors() {
    setErrors({});
    setValidation(undefined);
    intent.dismissError();
  }
  function focusInvalid() {
    (errors.amount ? amountRef : descriptionRef).current?.focus();
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (intent.phase !== 'editing') return;
    const parsed = createTransactionRequestSchema.safeParse({
      type,
      amount,
      description,
      reference_id: crypto.randomUUID(),
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = 'invalid';
      setValidation(validationError(parsed.error.issues));
      setErrors(next);
      (next.amount ? amountRef : descriptionRef).current?.focus();
      return;
    }
    clearErrors();
    runSafely(() => intent.send(parsed.data), 'transaction.callback');
  }
  function newIntent() {
    intent.reset();
    setAmount('');
    setDescription('');
    clearErrors();
    requestAnimationFrame(() => amountRef.current?.focus());
  }
  const pending = intent.phase === 'submitting';
  const terminal = intent.phase === 'done' || intent.phase === 'duplicate';
  return (
    <form
      noValidate
      onSubmit={(event) => runSafely(() => submit(event), 'transaction.submit')}
      className={styles.form}
      aria-label="New transaction"
    >
      <div className={styles.formIntro}>
        <h2 style={{ fontSize: 'var(--text-xl)' }}>New transaction</h2>
        <p>Add a credit or record a debit.</p>
      </div>
      <fieldset disabled={intent.phase !== 'editing'} className={styles.formFields}>
        <legend className="sr-only">Transaction details</legend>
        <SelectField
          label="Transaction type"
          value={type}
          onChange={(event) => setType(event.target.value === 'debit' ? 'debit' : 'credit')}
        >
          <option value="credit">Credit — add funds</option>
          <option value="debit">Debit — subtract funds</option>
        </SelectField>
        <TextField
          ref={amountRef}
          label="Amount"
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          required
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            clearErrors();
          }}
          aria-invalid={Boolean(errors.amount) || undefined}
          aria-describedby={validation ? 'transaction-error' : undefined}
          hint="Positive amount · Up to 2 decimal places"
        />
        <TextAreaField
          ref={descriptionRef}
          label="Description (optional)"
          name="description"
          placeholder="What is this transaction for?"
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            clearErrors();
          }}
          aria-invalid={Boolean(errors.description) || undefined}
          aria-describedby={validation ? 'transaction-error' : undefined}
        />
      </fieldset>
      {intent.phase === 'editing' && (
        <>
          <Button type="submit">
            <Icon name={type === 'credit' ? 'plus' : 'minus'} />
            Add {type}
          </Button>
        </>
      )}
      {(validation ?? intent.error) && (
        <ErrorNotice
          id="transaction-error"
          error={(validation ?? intent.error)!}
          context="transaction"
          uncertain={intent.phase === 'uncertain'}
          onRetry={() => {
            if (intent.payload && intent.phase === 'uncertain') return intent.send(intent.payload);
            amountRef.current?.form?.requestSubmit();
          }}
          onFixInput={() => {
            if (validation) focusInvalid();
            else amountRef.current?.focus();
          }}
          onReview={onChanged}
        />
      )}
      {pending && <Button loading>Recording {type}…</Button>}
      {intent.phase === 'uncertain' && (
        <>
          <Button variant="subtle" onClick={newIntent}>
            Start a different transaction
          </Button>
        </>
      )}
      {intent.phase === 'done' && intent.result && (
        <StatusMessage
          tone="success"
          title={`${intent.result.transaction.type === 'credit' ? 'Credit' : 'Debit'} recorded`}
        >
          {intent.result.transaction.amount} recorded. Balance and history are being refreshed.
        </StatusMessage>
      )}

      {terminal && (
        <Button variant="secondary" onClick={newIntent}>
          New transaction
          <Icon name="plus" />
        </Button>
      )}
      {intent.payload && (
        <p className={styles.reference}>
          Reference <code>{intent.payload.reference_id}</code>
        </p>
      )}
      <p className={styles.footnote}>
        <Icon name="shield" /> One reference per intent. Every accepted entry is permanent.
      </p>
    </form>
  );
}
