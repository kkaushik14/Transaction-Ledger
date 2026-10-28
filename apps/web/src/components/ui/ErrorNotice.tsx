/** One consistent failure view shows only mapped instructions, code, support ID and a recovery button. */
import { useEffect, useRef, useState } from 'react';
import { resolveErrorMessage, resolveActionLabel, type ErrorContext } from '@ledger/contracts';
import { ApplicationError, reportError, runSafely } from '../../errors/index.js';
import { Button } from './Button';
import styles from './ui.module.css';
export interface ErrorNoticeProps {
  error: ApplicationError;
  context?: ErrorContext;
  uncertain?: boolean;
  onRetry?: (() => void | Promise<unknown>) | undefined;
  onReview?: (() => void | Promise<unknown>) | undefined;
  onFixInput?: (() => void | Promise<unknown>) | undefined;
  onGoBack?: (() => void | Promise<unknown>) | undefined;
  id?: string;
  relatedErrors?: readonly ApplicationError[] | undefined;
}
/** Copy is resolved from trusted codes, never Error.message or a received server message. */
export function ErrorNotice({
  error,
  context = 'general',
  uncertain = false,
  onRetry,
  onReview,
  onFixInput,
  onGoBack,
  id,
  relatedErrors,
}: ErrorNoticeProps) {
  const [recovering, setRecovering] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // Restored intentions and locally constructed failures also need a log for the ID actually shown.
  useEffect(() => {
    reportError(error, `ui.error.${context}`, relatedErrors);
  }, [error, context, relatedErrors]);
  const presentation = resolveErrorMessage(error.code, context, uncertain);
  const performRecovery = () => {
    const callback = {
      retry: onRetry,
      review: onReview,
      fix_input: onFixInput,
      go_back: onGoBack,
      reload: undefined,
    }[presentation.action];
    if (callback) return callback();
    if (
      presentation.action === 'go_back' ||
      presentation.action === 'review' ||
      presentation.action === 'fix_input'
    )
      window.location.assign('/#get-started');
    else window.location.reload(); // Reload never auto-submits stored financial intentions.
  };
  async function recover() {
    if (lock.current) return;
    lock.current = true;
    setRecovering(true);
    try {
      await performRecovery();
    } finally {
      lock.current = false;
      if (mounted.current) setRecovering(false);
    }
  }
  return (
    <div role="alert" className={`${styles.status} ${styles.errorStatus}`} id={id}>
      <div className={styles.failure}>
        <p>{presentation.message}</p>
        <p className={styles.failureMeta}>
          Error code: <code>{error.code}</code>
        </p>
        <p className={styles.failureMeta}>
          Support ticket ID: <code>{error.supportTicketId}</code>
        </p>
        <Button
          variant="secondary"
          loading={recovering}
          onClick={() => runSafely(recover, 'error.recovery')}
        >
          {resolveActionLabel(presentation.action, context, uncertain)}
        </Button>
      </div>
    </div>
  );
}
