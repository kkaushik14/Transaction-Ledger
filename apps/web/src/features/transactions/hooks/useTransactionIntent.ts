/** Explicit write state machine keeps new intentions separate from uncertain retries. */
import { useEffect, useRef, useState } from 'react';
import type { CreateTransactionRequest, CreateTransactionResponse } from '@ledger/contracts';
import { createTransaction, ApiClientError, errorMessage } from '../../../api/index.js';

import { clearPendingIntent, readPendingIntent, savePendingIntent } from './transaction-intent';
/** Form phases prevent input changes while an unresolved payload/reference must remain identical. */
export type IntentPhase = 'editing' | 'submitting' | 'uncertain' | 'done' | 'duplicate';
interface IntentState {
  phase: IntentPhase;
  payload: CreateTransactionRequest | undefined;
  message: string | undefined;
  result: CreateTransactionResponse['data'] | undefined;
}
/** Submits once, preserves uncertain results, and refreshes authoritative reads after known writes/conflicts. */
export function useTransactionIntent(accountId: string, onChanged: () => void) {
  const [state, setState] = useState<IntentState>(() => {
    const payload = readPendingIntent(accountId);
    return {
      phase: payload ? 'uncertain' : 'editing',
      payload,
      message: payload
        ? 'An earlier request has an unconfirmed result. Review history or retry the same request.'
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
    if (!savePendingIntent(accountId, payload)) {
      lock.current = false;
      setState((current) => ({
        ...current,
        message: 'Retry details could not be saved. Enable session storage before continuing.',
      }));
      return;
    }
    setState({ phase: 'submitting', payload, message: undefined, result: undefined });
    let refresh = false;
    try {
      const response = await createTransaction(accountId, payload);
      clearPendingIntent(accountId, payload.reference_id);
      if (mounted.current) {
        setState({ phase: 'done', payload, message: undefined, result: response.data });
        refresh = true;
      }
    } catch (error) {
      const uncertain =
        !(error instanceof ApiClientError) ||
        error.uncertain ||
        (state.phase === 'uncertain' && error.code === 'CONFIGURATION_ERROR');
      const duplicate = error instanceof ApiClientError && error.code === 'DUPLICATE_TRANSACTION';
      if (!uncertain) clearPendingIntent(accountId, payload.reference_id);
      if (mounted.current) {
        setState({
          phase: uncertain ? 'uncertain' : duplicate ? 'duplicate' : 'editing',
          payload: uncertain || duplicate ? payload : undefined,
          message: duplicate
            ? 'This reference is already recorded. No new movement was made; your account has been refreshed.'
            : errorMessage(error),
          result: undefined,
        });
        refresh = duplicate || (error instanceof ApiClientError && error.status === 422);
      }
    } finally {
      lock.current = false;
    }
    // Refetch errors must remain read failures, never reclassify a committed write.
    if (refresh && mounted.current) onChanged();
  }
  function reset() {
    if (lock.current) return;
    if (state.payload) clearPendingIntent(accountId, state.payload.reference_id);
    setState({ phase: 'editing', payload: undefined, message: undefined, result: undefined });
  }
  return { ...state, send, reset };
}
