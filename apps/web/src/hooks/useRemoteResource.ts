/** Abortable remote state keyed by identity; outdated requests never overwrite the selected account/query. */
import { useEffect, useReducer, useState } from 'react';
import { ApiClientError } from '../api/client';
/** Fetches on identity/refresh changes while retaining only same-identity data during refresh. */
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
          setState({
            identity,
            revision,
            error:
              error instanceof ApiClientError
                ? error
                : new ApiClientError(
                    'Unable to load this data. Please try again.',
                    'NETWORK_ERROR',
                  ),
          });
      });
    return () => controller.abort();
  }, [identity, load, revision]);
  const current = state?.identity === identity ? state : undefined;
  const loading = !current || current.revision !== revision;
  return { data: current?.data, error: loading ? undefined : current?.error, loading, refresh };
}
