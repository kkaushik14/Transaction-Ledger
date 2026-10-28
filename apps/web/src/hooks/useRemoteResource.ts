/** Abortable remote state keyed by identity; outdated requests never overwrite the selected account/query. */
import { useEffect, useReducer, useState } from 'react';
import { ApiClientError } from '../api/index.js';
/** Fetches by identity/revision, retaining only same-identity data on refresh/failure with explicit error state. */
export function useRemoteResource<T>(identity: string, load: (signal: AbortSignal) => Promise<T>) {
  const [revision, refresh] = useReducer((value: number) => value + 1, 0);
  const [state, setState] = useState<{
    identity: string;
    revision: number;
    data?: T;
    error?: ApiClientError;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ identity, revision, data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState((previous) => ({
            identity,
            revision,
            // A read failure must not erase a committed receipt/workflow. Retain
            // only this identity's last known data and let consumers label it stale.
            ...(previous?.identity === identity && previous.data !== undefined
              ? { data: previous.data }
              : {}),
            error:
              error instanceof ApiClientError
                ? error
                : new ApiClientError(
                    'Unable to load this data. Please try again.',
                    'NETWORK_ERROR',
                  ),
          }));
      });
    return () => controller.abort();
  }, [identity, load, revision]);
  const current = state?.identity === identity ? state : undefined;
  const loading = !current || current.revision !== revision;
  return { data: current?.data, error: loading ? undefined : current?.error, loading, refresh };
}
