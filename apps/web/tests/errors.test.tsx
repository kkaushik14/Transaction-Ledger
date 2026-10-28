/** Error UI, hostile server messages, causality, safe recovery and application-level boundaries. */
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  ApplicationError,
  asApplicationError,
  getErrorDiagnostics,
  reportError,
  runSafely,
  renderFatalError,
} from '../src/errors/index.js';
import { TransactionHistory } from '../src/features/transactions/index.js';
import { ErrorNotice } from '../src/components/ui/index.js';
import { ApplicationErrorBoundary, GlobalErrorHandler } from '../src/components/layout/index.js';
import {
  useTransactionIntent,
  savePendingIntent,
  readPendingIntent,
} from '../src/features/transactions/hooks/index.js';
import {
  useTransferIntent,
  saveTransferIntent,
  readTransferIntent,
} from '../src/features/transfers/hooks/index.js';
import { useRemoteResource } from '../src/hooks/index.js';
import { apiRequest } from '../src/api/index.js';
import { accountBalanceResponseSchema } from '@ledger/contracts';
import { accountId, transactionResponse, jsonResponse } from './fixtures';
const ticket = '11111111-1111-4111-8111-111111111111';

describe('central browser errors', () => {
  it('shows exactly one mapped alert and action without the original message, cause, stack or technical fields', async () => {
    const original = new Error('password=secret SELECT private_sql');
    const error = new ApplicationError(
      'raw driver stack',
      'ACCOUNT_NOT_FOUND',
      404,
      { cause: original },
      ticket,
    );
    const back = vi.fn();
    render(<ErrorNotice error={error} onGoBack={back} />);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Account not found');
    expect(screen.getByRole('alert')).toHaveTextContent(ticket);
    expect(screen.getByRole('alert')).toHaveTextContent('ACCOUNT_NOT_FOUND');
    expect(screen.getByRole('alert').textContent).not.toMatch(
      /SELECT|private_sql|raw driver|password|stack/,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Go Back' }));
    expect(back).toHaveBeenCalledTimes(1);
  });
  it('ignores a valid server envelope’s hostile message/action copy and preserves server support correlation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        jsonResponse(
          {
            error: {
              support_ticket_id: ticket,
              code: 'ACCOUNT_NOT_FOUND',
              message: '<script>SELECT password=secret</script>',
              action: 'retry',
            },
          },
          404,
        ),
      ),
    );
    let failure: unknown;
    try {
      await apiRequest(`/accounts/${accountId}/balance`, accountBalanceResponseSchema);
    } catch (error: unknown) {
      failure = error;
    }
    const error = asApplicationError(failure);
    render(<ErrorNotice error={error} />);
    expect(screen.getByRole('alert')).toHaveTextContent(ticket);
    expect(screen.getByRole('alert').textContent).not.toMatch(/script|SELECT|secret/);
    expect(screen.getByRole('button', { name: 'Go Back' })).toBeInTheDocument();
  });
  it('treats malformed legacy HTTP failures as unconfirmed, never as a safe financial rejection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        jsonResponse(
          { error: { code: 'INSUFFICIENT_BALANCE', message: 'secret', details: {} } },
          422,
        ),
      ),
    );
    await expect(
      apiRequest('/test', accountBalanceResponseSchema, { method: 'POST', body: {} }),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE', uncertain: true });
  });
  it('retains nested original errors privately, correlates unknown values once and deduplicates diagnostic output', () => {
    const cause = new Error('original private diagnostic');
    const original = new Error('higher level', { cause });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const first = reportError(original, 'test.first');
      const second = reportError(original, 'test.second');
      expect(first).toBe(second);
      expect(first.cause).toBe(original);
      expect((first.cause as Error).cause).toBe(cause);
      expect(
        getErrorDiagnostics().find(
          (record) => record.error.supportTicketId === first.supportTicketId,
        )?.error,
      ).toBe(first);
      expect(log).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(log.mock.calls)).not.toContain('private diagnostic');
    } finally {
      log.mockRestore();
    }
  });
  it('captures synchronous read-loader exceptions through the same rejection path', async () => {
    const original = new Error('private synchronous loader');
    const load = () => {
      throw original;
    };
    const { result } = renderHook(() => useRemoteResource('test', load));
    await waitFor(() => expect(result.current.error?.code).toBe('INTERNAL_ERROR'));
    expect(result.current.error?.cause).toBe(original);
    expect(result.current.loading).toBe(false);
  });
  it('keeps response-header support correlation when a failed response is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(
        async () =>
          new Response('private invalid payload', {
            status: 500,
            headers: { 'X-Support-Ticket-ID': ticket },
          }),
      ),
    );
    await expect(apiRequest('/test', accountBalanceResponseSchema)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      supportTicketId: ticket,
      uncertain: true,
    });
  });
  it.each([
    [400, 'VALIDATION_ERROR'],
    [404, 'ACCOUNT_NOT_FOUND'],
    [422, 'INSUFFICIENT_BALANCE'],
  ] as const)(
    'preserves an earlier unknown financial outcome after a later %s rejection',
    async (status, code) => {
      const command = {
        type: 'credit' as const,
        amount: '1.00',
        reference_id: 'unknown-transaction',
        description: '',
      };
      const transfer = {
        source_account_id: accountId,
        destination_account_id: 'bbbbbbbb-0000-4000-8000-000000000002',
        amount: '1.00',
        reference_id: 'unknown-transfer',
        description: '',
      };
      savePendingIntent(accountId, command);
      saveTransferIntent(accountId, transfer);
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>(async () =>
          jsonResponse(
            {
              error: {
                code,
                support_ticket_id: ticket,
                message: 'Rejected retry',
                action: 'fix_input',
              },
            },
            status,
          ),
        ),
      );
      const transaction = renderHook(() => useTransactionIntent(accountId, vi.fn()));
      const moving = renderHook(() => useTransferIntent(accountId, vi.fn()));
      await act(() => transaction.result.current.send(command));
      await act(() => moving.result.current.send());
      expect(transaction.result.current.phase).toBe('uncertain');
      expect(moving.result.current.phase).toBe('uncertain');
      expect(readPendingIntent(accountId)).toEqual(command);
      expect(readTransferIntent(accountId)).toEqual(transfer);
    },
  );
  it('logs a mismatched late receipt even after its originating form unmounts', async () => {
    let finish: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const command = {
      type: 'credit' as const,
      amount: '1.00',
      reference_id: 'late-error',
      description: '',
    };
    const view = renderHook(() => useTransactionIntent(accountId, vi.fn()));
    let pending: Promise<void> | undefined;
    act(() => {
      pending = view.result.current.send(command);
    });
    view.unmount();
    await act(async () => {
      finish?.(jsonResponse(transactionResponse, 201));
      await pending;
    });
    expect(
      getErrorDiagnostics().some(
        (record) =>
          record.scope === 'transactions.write' && record.error.code === 'INVALID_RESPONSE',
      ),
    ).toBe(true);
    expect(readPendingIntent(accountId)).toEqual(command);
  });
  it('uses safe generic copy for unknown thrown values', () => {
    const error = asApplicationError({ database: 'secret', stack: 'private' });
    render(<ErrorNotice error={error} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('alert').textContent).not.toContain('secret');
  });
  it.each(['transaction', 'transfer'] as const)(
    'offers only the exact safe %s retry action without auto-sending',
    async (context) => {
      const retry = vi.fn();
      render(
        <ErrorNotice
          error={new ApplicationError('offline', 'NETWORK_ERROR')}
          context={context}
          uncertain
          onRetry={retry}
        />,
      );
      expect(retry).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('may already be recorded');
      await userEvent.click(
        screen.getByRole('button', {
          name: context === 'transfer' ? 'Retry same transfer' : 'Retry same request',
        }),
      );
      expect(retry).toHaveBeenCalledTimes(1);
    },
  );
  it('never offers a blind retry for an unconfirmed non-idempotent account creation', async () => {
    const back = vi.fn(),
      retry = vi.fn();
    render(
      <ErrorNotice
        error={new ApplicationError('offline', 'NETWORK_ERROR')}
        context="account-create"
        uncertain
        onGoBack={back}
        onRetry={retry}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Retrying may create another account');
    await userEvent.click(screen.getByRole('button', { name: 'Go Back' }));
    expect(back).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });
  it.each(['sync', 'async'])(
    'catches %s callback failures and displays one safe application-level recovery screen',
    async (kind) => {
      const original = new Error('private callback details');
      render(
        <GlobalErrorHandler>
          <p>Working screen</p>
        </GlobalErrorHandler>,
      );
      await act(async () => {
        runSafely(() => {
          if (kind === 'sync') throw original;
          return Promise.reject(original);
        }, 'test.callback');
      });
      expect(await screen.findByRole('alert')).toHaveTextContent('INTERNAL_ERROR');
      expect(screen.queryByText('Working screen')).not.toBeInTheDocument();
      expect(screen.getAllByRole('alert')).toHaveLength(1);
      expect(screen.getByRole('alert').textContent).not.toContain('private callback');
    },
  );
  it('handles truly unhandled rejections and removes global listeners on unmount', async () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const view = render(
      <GlobalErrorHandler>
        <p>Screen</p>
      </GlobalErrorHandler>,
    );
    const event = new Event('unhandledrejection', { cancelable: true });
    Object.defineProperty(event, 'reason', { value: new Error('private unhandled') });
    act(() => {
      window.dispatchEvent(event);
    });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('INTERNAL_ERROR'));
    expect(event.defaultPrevented).toBe(true);
    view.unmount();
    expect(remove).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    remove.mockRestore();
  });
  it('catches render failures with the same public fallback and preserves their cause', () => {
    const original = new Error('private render details');
    function Broken(): never {
      throw original;
    }
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <ApplicationErrorBoundary>
          <Broken />
        </ApplicationErrorBoundary>,
      );
      expect(screen.getByRole('alert')).toHaveTextContent('INTERNAL_ERROR');
      expect(screen.getByRole('alert').textContent).not.toContain('private render');
      expect(getErrorDiagnostics().some((record) => record.error.cause === original)).toBe(true);
    } finally {
      log.mockRestore();
    }
  });
  it('provides a four-field safe bootstrap fallback even when React cannot mount', () => {
    const container = document.createElement('div');
    container.id = 'root';
    document.body.append(container);
    try {
      renderFatalError(new Error('<script>private bootstrap stack</script>'));
      expect(container.querySelector('[role="alert"]')).toBeTruthy();
      expect(container.querySelectorAll('p')).toHaveLength(3);
      expect(container.querySelectorAll('button')).toHaveLength(1);
      expect(container.textContent).not.toContain('private bootstrap');
      expect(container.querySelector('script')).toBeNull();
    } finally {
      container.remove();
    }
  });
});

describe('support tracing and recovery audit', () => {
  it('logs the exact ID shown for a restored unresolved intention without sending it automatically', () => {
    const command = {
      type: 'credit' as const,
      amount: '1.00',
      reference_id: 'restored-trace',
      description: '',
    };
    savePendingIntent(accountId, command);
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    function Restored() {
      const intent = useTransactionIntent(accountId, vi.fn());
      return intent.error ? (
        <ErrorNotice
          error={intent.error}
          context="transaction"
          uncertain
          onRetry={() => intent.send(command)}
        />
      ) : null;
    }
    render(<Restored />);
    const id = screen.getByText(/Support ticket ID:/).querySelector('code')!.textContent!;
    expect(getErrorDiagnostics(id)).toHaveLength(1);
    expect(getErrorDiagnostics(id)[0]?.scope).toBe('ui.error.transaction');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('links coalesced failures to the visible support ID without exposing related IDs in the notice', () => {
    const balance = new ApplicationError('Balance failed', 'NETWORK_ERROR');
    const history = new ApplicationError('History failed', 'NETWORK_ERROR');
    render(
      <>
        <ErrorNotice error={balance} context="account-data" relatedErrors={[history]} />
        <TransactionHistory
          data={undefined}
          loading={false}
          error={history}
          errorReported
          filter="all"
          onFilter={() => {}}
          onPage={() => {}}
          onRetry={() => {}}
        />
      </>,
    );
    const [record] = getErrorDiagnostics(balance.supportTicketId);
    expect(record?.relatedSupportTicketIds).toContain(history.supportTicketId);
    expect(getErrorDiagnostics(history.supportTicketId)).toContain(record);
    expect(screen.getByRole('alert')).toHaveTextContent('balance and transaction history');
    expect(screen.getByRole('button', { name: 'Retry account' })).toBeInTheDocument();
    expect(screen.getByRole('alert').textContent).not.toContain(history.supportTicketId);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Transaction history' })).toBeInTheDocument();
    expect(screen.getByText('Waiting for account data refresh…')).toBeInTheDocument();
  });
  it('retains support trace and the logging failure if the browser console is unavailable', () => {
    const original = new Error('original cause');
    const sinkFailure = new Error('console unavailable');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {
      throw sinkFailure;
    });
    try {
      const error = reportError(original, 'audit.console');
      render(<ErrorNotice error={error} />);
      const record = getErrorDiagnostics(error.supportTicketId)[0];
      expect(record?.error.cause).toBe(original);
      expect(record?.consoleError).toBe(sinkFailure);
      expect(screen.getByRole('alert')).toHaveTextContent(error.supportTicketId);
    } finally {
      spy.mockRestore();
    }
  });
  it('does not invoke an asynchronous recovery twice while it is pending', async () => {
    let finish: (() => void) | undefined;
    const retry = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <ErrorNotice error={new ApplicationError('network', 'NETWORK_ERROR')} onRetry={retry} />,
    );
    const button = screen.getByRole('button', { name: 'Retry' });
    await userEvent.dblClick(button);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    await act(async () => {
      finish?.();
    });
    expect(button).toBeEnabled();
  });
  it('treats disagreement between header/body support IDs as unconfirmed and keeps the header correlation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                support_ticket_id: accountId,
                code: 'ACCOUNT_NOT_FOUND',
                message: 'Untrusted copy',
                action: 'go_back',
              },
            }),
            { status: 404, headers: { 'X-Support-Ticket-ID': ticket } },
          ),
      ),
    );
    await expect(apiRequest('/test', accountBalanceResponseSchema)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      uncertain: true,
      supportTicketId: ticket,
    });
  });
  it('retains a valid body support ID when another envelope field is malformed and the header is absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        jsonResponse(
          {
            error: {
              support_ticket_id: ticket,
              code: 'unrecognized',
              message: 'Untrusted',
              action: 'retry',
            },
          },
          500,
        ),
      ),
    );
    await expect(apiRequest('/test', accountBalanceResponseSchema)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      supportTicketId: ticket,
    });
  });
  it('normalizes unknown revoked proxies and treats unexpected local failures as unconfirmed', () => {
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    const error = asApplicationError(proxy);
    expect(error.cause).toBe(proxy);
    expect(asApplicationError(proxy)).toBe(error);
    expect(error.uncertain).toBe(true);
    render(<ErrorNotice error={error} context="account-create" uncertain={error.uncertain} />);
    expect(screen.getByRole('button', { name: 'Go Back' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Retrying may create another account');
  });
});
