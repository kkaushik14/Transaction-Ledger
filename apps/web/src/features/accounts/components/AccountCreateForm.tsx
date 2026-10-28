/** Name-only account entry; shared validation precedes HTTP and successful navigation carries known name. */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAccountRequestSchema } from '@ledger/contracts';
import { createAccount } from '../../../api/index.js';

import { Button, TextField, ErrorNotice, Icon } from '../../../components/ui/index.js';

import {
  ApplicationError,
  reportError,
  runSafely,
  validationError,
} from '../../../errors/index.js';
import styles from './accounts.module.css';
import { useActiveAccount } from '../hooks/index.js';
/** Creates an account without accepting a balance or pretending to provide authentication. */
export function AccountCreateForm() {
  const active = useActiveAccount();
  const [name, setName] = useState('');
  const [fieldError, setFieldError] = useState(false);
  const [error, setError] = useState<ApplicationError>();
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
      setFieldError(true);
      setError(validationError(parsed.error.issues));
      field.current?.focus();
      return;
    }
    lock.current = true;
    setPending(true);
    setError(undefined);
    setFieldError(false);
    try {
      const result = await createAccount(parsed.data);
      // A completed write must not pull the user back after they leave account entry.
      if (!mounted.current) return;
      active?.select({ id: result.data.id, name: result.data.name });
      runSafely(
        () =>
          navigate(`/accounts/${result.data.id}`, {
            state: { accountId: result.data.id, accountName: result.data.name },
          }),
        'account.navigation',
      );
    } catch (error: unknown) {
      const failure = reportError(error, 'account.create');
      if (!mounted.current) return;
      setError(failure);
    } finally {
      lock.current = false;
      if (mounted.current) setPending(false);
    }
  }
  return (
    <form
      noValidate
      onSubmit={(event) => runSafely(() => submit(event), 'account.create.callback')}
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
        hint="Names can repeat. Save your Account ID to reopen the right account."
        required
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setFieldError(false);
          setError(undefined);
        }}
        aria-invalid={fieldError || undefined}
        aria-describedby={error ? 'account-create-error' : undefined}
        disabled={pending || Boolean(error?.uncertain)}
      />
      {error && (
        <ErrorNotice
          id="account-create-error"
          error={error}
          context="account-create"
          uncertain={error.uncertain}
          onFixInput={() => field.current?.focus()}
          onRetry={() => field.current?.form?.requestSubmit()}
          onGoBack={() => {
            setError(undefined);
            return navigate('/#get-started', { state: { entry: 'lookup' } });
          }}
        />
      )}
      <Button type="submit" loading={pending} disabled={Boolean(error?.uncertain)}>
        {pending ? 'Creating account…' : 'Create account'}
        {!pending && <Icon name="arrow" />}
      </Button>
      <p className={styles.formHeading}>No sign-up or initial deposit required.</p>
    </form>
  );
}
