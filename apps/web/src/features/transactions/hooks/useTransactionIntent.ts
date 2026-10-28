/** Explicit write state machine keeps new intentions separate from uncertain retries. */
import { ApplicationError, reportError, runSafely } from '../../../errors/index.js';
import { useEffect, useRef, useState } from 'react';
import type { CreateTransactionRequest, CreateTransactionResponse } from '@ledger/contracts';
import { createTransaction, ApiClientError } from '../../../api/index.js';

import { clearPendingIntent, readPendingIntent, savePendingIntent } from './transaction-intent';
/** Form phases prevent input changes while an unresolved payload/reference must remain identical. */
export type IntentPhase = 'editing' | 'submitting' | 'uncertain' | 'done' | 'duplicate';
interface IntentState {
  phase: IntentPhase;
  payload: CreateTransactionRequest | undefined;
  error: ApplicationError | undefined;
  result: CreateTransactionResponse['data'] | undefined;
}
/** Submits once, preserves uncertain results, and refreshes authoritative reads after known writes/conflicts. */
export function useTransactionIntent(accountId: string, onChanged: () => void) {
  const [state, setState] = useState<IntentState>(() => {
    const payload = readPendingIntent(accountId);
    return {
      phase: payload ? 'uncertain' : 'editing',
      payload,
      error: payload
        ? new ApplicationError('Restored unresolved request', 'INVALID_RESPONSE')
        : undefined,
      result: undefined,
    };
  });
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function send(payload: CreateTransactionRequest) {
    if (lock.current) return;
    lock.current = true;
    // Save BEFORE sending: navigation or a lost response must not turn a retry
    // into a second movement with a freshly generated reference.
    try {
      savePendingIntent(accountId, payload);
    } catch (error: unknown) {
      lock.current = false;
      const failure = reportError(error, 'transactions.persist');
      if (mounted.current) setState((current) => ({ ...current, error: failure }));
      return;
    }
    setState({ phase: 'submitting', payload, error: undefined, result: undefined });
    let refresh = false;
    try {
      const response = await createTransaction(accountId, payload);
      clearPendingIntent(accountId, payload.reference_id);
      if (mounted.current) {
        setState({ phase: 'done', payload, error: undefined, result: response.data });
        refresh = true;
      }
    } catch (error: unknown) {
      const failure = reportError(error, 'transactions.write');
      const duplicate = error instanceof ApiClientError && error.code === 'DUPLICATE_TRANSACTION';
      // Rejecting a later retry does not prove an earlier unconfirmed request failed.
      const uncertain =
        !(error instanceof ApiClientError) ||
        error.uncertain ||
        (state.phase === 'uncertain' && !duplicate);
      if (!uncertain) clearPendingIntent(accountId, payload.reference_id);
      if (mounted.current) {
        setState({
          phase: uncertain ? 'uncertain' : duplicate ? 'duplicate' : 'editing',
          payload: uncertain || duplicate ? payload : undefined,
          error: failure,
          result: undefined,
        });
        refresh = duplicate || (error instanceof ApiClientError && error.status === 422);
      }
    } finally {
      lock.current = false;
    }
    // Refetch errors must remain read failures, never reclassify a committed write.
    if (refresh && mounted.current) runSafely(onChanged, 'transactions.refresh');
  }
  function reset() {
    if (lock.current) return;
    if (state.payload) clearPendingIntent(accountId, state.payload.reference_id);
    setState({ phase: 'editing', payload: undefined, error: undefined, result: undefined });
  }
  return {
    ...state,
    send,
    reset,
    dismissError: () => {
      if (state.phase === 'editing') setState((current) => ({ ...current, error: undefined }));
    },
  };
}
