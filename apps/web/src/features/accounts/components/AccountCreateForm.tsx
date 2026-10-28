/** Name-only account entry; shared validation precedes HTTP and successful navigation carries known name. */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAccountRequestSchema } from '@ledger/contracts';
import { createAccount, ApiClientError, errorMessage } from '../../../api/index.js';

import { Button, TextField, StatusMessage, Icon } from '../../../components/ui/index.js';

import styles from './accounts.module.css';
/** Creates an account without accepting a balance or pretending to provide authentication. */
export function AccountCreateForm() {
  const [name, setName] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  const field = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const parsed = createAccountRequestSchema.safeParse({ name });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Enter an account name.');
      field.current?.focus();
      return;
    }
    lock.current = true;
    setPending(true);
    setError(undefined);
    setFieldError(undefined);
    try {
      const result = await createAccount(parsed.data);
      // A completed write must not pull the user back after they leave account entry.
      if (!mounted.current) return;
      void navigate(`/accounts/${result.data.id}`, {
        state: { accountId: result.data.id, accountName: result.data.name },
      });
    } catch (error) {
      if (!mounted.current) return;
      setError(
        error instanceof ApiClientError && error.uncertain
          ? 'We could not confirm whether the account was created. Retrying may create another account.'
          : errorMessage(error),
      );
    } finally {
      lock.current = false;
      if (mounted.current) setPending(false);
    }
  }
  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className={styles.form}
      aria-label="Create an account"
    >
      <div className={styles.formHeading}>
        <h3>Create an account</h3>
        <p>Start at zero. Your first entry is up to you.</p>
      </div>
      <TextField
        ref={field}
        id="account-create-name"
        label="Account name"
        name="name"
        autoComplete="name"
        placeholder="e.g. Alex Morgan"
        required
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setFieldError(undefined);
        }}
        error={fieldError}
        disabled={pending}
      />
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
      <Button type="submit" loading={pending}>
        {pending ? 'Creating account…' : 'Create account'}
        {!pending && <Icon name="arrow" />}
      </Button>
      <p className={styles.formHeading}>No sign-up or initial deposit required.</p>
    </form>
  );
}
