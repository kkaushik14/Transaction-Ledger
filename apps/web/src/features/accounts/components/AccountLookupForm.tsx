/** UUID-only account lookup; the account route verifies existence and never invents missing names. */
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountIdParamsSchema } from '@ledger/contracts';
import { TextField, Button, Icon } from '../../../components/ui/index.js';

import styles from './accounts.module.css';
/** Navigates only after UUID validation; no account-list or authentication endpoint is assumed. */
export function AccountLookupForm() {
  const [id, setId] = useState('');
  const [error, setError] = useState<string>();
  const field = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = accountIdParamsSchema.safeParse({ accountId: id.trim() });
    if (!parsed.success) {
      setError('Enter a valid account UUID.');
      field.current?.focus();
      return;
    }
    void navigate(`/accounts/${parsed.data.accountId}`);
  }
  return (
    <form noValidate onSubmit={submit} className={styles.form} aria-label="Open an account">
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
        placeholder="Paste your account UUID"
        required
        value={id}
        onChange={(event) => {
          setId(event.target.value);
          setError(undefined);
        }}
        error={error}
        hint="Use the ID provided when your account was created."
      />
      <Button type="submit" variant="secondary">
        Open account
        <Icon name="arrow" />
      </Button>
    </form>
  );
}
