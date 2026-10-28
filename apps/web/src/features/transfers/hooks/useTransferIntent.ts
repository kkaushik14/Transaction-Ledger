/** Explicit transfer state machine freezes commands across uncertain results and never retries automatically. */
import { useEffect, useRef, useState } from 'react';
import type { CreateTransferRequest, CreateTransferResponse } from '@ledger/contracts';
import { ApiClientError, createTransfer, errorMessage } from '../../../api/index.js';
import { clearTransferIntent, readTransferIntent, saveTransferIntent } from './transfer-intent';
/** UI states distinguish known rejection/conflict from an outcome that is still unconfirmed. */
export type TransferPhase =
  'editing' | 'reviewing' | 'submitting' | 'uncertain' | 'success' | 'conflict';
interface TransferState {
  phase: TransferPhase;
  payload: CreateTransferRequest | undefined;
  result: CreateTransferResponse['data'] | undefined;
  message: string | undefined;
}
/** Owns one transfer intent per selected source; callers key their component by account identity. */
export function useTransferIntent(source: string, onChanged: () => void) {
  const [state, setState] = useState<TransferState>(() => {
    const payload = readTransferIntent(source);
    return {
      phase: payload ? 'uncertain' : 'editing',
      payload,
      result: undefined,
      message: payload
        ? 'An earlier transfer has an unconfirmed result. Your original details are preserved.'
        : undefined,
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
  function review(payload: CreateTransferRequest) {
    if (lock.current || state.phase !== 'editing') return;
    setState({ phase: 'reviewing', payload, result: undefined, message: undefined });
  }
  function edit() {
    if (!lock.current && state.phase === 'reviewing')
      setState({ phase: 'editing', payload: undefined, result: undefined, message: undefined });
  }
  async function send() {
    if (lock.current || !state.payload || !['reviewing', 'uncertain'].includes(state.phase)) return;
    lock.current = true;
    const payload = state.payload;
    if (!saveTransferIntent(source, payload)) {
      lock.current = false;
      setState((current) => ({
        ...current,
        message: 'Retry details could not be saved. Enable session storage before continuing.',
      }));
      return;
    }
    setState({ phase: 'submitting', payload, result: undefined, message: undefined });
    let refresh = false;
    try {
      const response = await createTransfer(payload);
      clearTransferIntent(source, payload.reference_id);
      if (mounted.current) {
        setState({ phase: 'success', payload, result: response.data, message: undefined });
        refresh = true;
      }
    } catch (error) {
      const uncertain =
        !(error instanceof ApiClientError) ||
        error.uncertain ||
        (state.phase === 'uncertain' && error.code === 'CONFIGURATION_ERROR');
      const conflict =
        error instanceof ApiClientError &&
        ['DUPLICATE_TRANSFER', 'DUPLICATE_TRANSACTION'].includes(error.code);
      // Keep conflicts preserved until the user explicitly reviews the account.
      // A 409 says a reference is used; it does not prove the earlier payload matched.
      if (!uncertain && !conflict) clearTransferIntent(source, payload.reference_id);
      if (mounted.current) {
        setState({
          phase: uncertain ? 'uncertain' : conflict ? 'conflict' : 'editing',
          payload: uncertain || conflict ? payload : undefined,
          result: undefined,
          message: conflict
            ? 'This reference is already used. This attempt made no new transfer. The earlier result has not been confirmed; review your balance and history.'
            : errorMessage(error),
        });
        refresh = conflict || (error instanceof ApiClientError && error.status === 422);
      }
    } finally {
      lock.current = false;
    }
    // Read failures must not fall into the write-error branch or cause a second POST.
    if (refresh && mounted.current) onChanged();
  }
  function reset() {
    if (lock.current || !['success', 'conflict'].includes(state.phase)) return;
    if (state.payload) clearTransferIntent(source, state.payload.reference_id);
    setState({ phase: 'editing', payload: undefined, result: undefined, message: undefined });
  }
  return { ...state, review, edit, send, reset };
}
