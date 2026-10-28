/** UUID-only account lookup; the account route verifies existence and never invents missing names. */
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountIdParamsSchema } from '@ledger/contracts';
import { TextField, Button, Icon, ErrorNotice } from '../../../components/ui/index.js';

import { ApplicationError, validationError, runSafely } from '../../../errors/index.js';
import styles from './accounts.module.css';
/** Navigates only after UUID validation; no account-list or authentication endpoint is assumed. */
export function AccountLookupForm() {
  const [id, setId] = useState('');
  const [error, setError] = useState<ApplicationError>();
  const field = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = accountIdParamsSchema.safeParse({ accountId: id.trim() });
    if (!parsed.success) {
      setError(validationError(parsed.error.issues));
      field.current?.focus();
      return;
    }
    runSafely(() => navigate(`/accounts/${parsed.data.accountId}`), 'account.lookup.navigation');
  }
  return (
    <form
      noValidate
      onSubmit={(event) => runSafely(() => submit(event), 'account.lookup.submit')}
      className={styles.form}
      aria-label="Open an account"
    >
      <div className={styles.formHeading}>
        <h3>Already have an account?</h3>
        <p>Pick up where you left off with your account ID.</p>
      </div>
      <TextField
        ref={field}
        id="account-lookup-id"
        label="Account ID"
        name="account_id"
        autoComplete="off"
        spellCheck={false}
        placeholder="Paste your Account ID"
        required
        value={id}
        onChange={(event) => {
          setId(event.target.value);
          setError(undefined);
        }}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? 'account-lookup-error' : undefined}
        hint="Use the ID provided when your account was created."
      />
      {error && (
        <ErrorNotice
          id="account-lookup-error"
          error={error}
          onFixInput={() => field.current?.focus()}
        />
      )}
      <Button type="submit" variant="secondary">
        Open account
        <Icon name="arrow" />
      </Button>
    </form>
  );
}
