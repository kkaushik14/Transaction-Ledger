/** Review regressions protect account selection, correlated reads/writes and preserved retry commands. */
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { getAccountBalance, createTransaction, getTransactionHistory } from '../src/api/index.js';
import { AppRoutes } from '../src/app/index.js';
import { TransactionForm } from '../src/features/transactions/index.js';
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
import { useAccount } from '../src/features/accounts/index.js';
import { accountId, jsonResponse, transactionResponse } from './fixtures';
const other = 'bbbbbbbb-0000-4000-8000-000000000002';
const command = {
  type: 'credit' as const,
  amount: '1.50',
  reference_id: 'review-reference',
  description: '',
};
const transfer = {
  source_account_id: accountId,
  destination_account_id: other,
  amount: '1.50',
  reference_id: 'review-transfer',
  description: '',
};
/** Returns only valid read projections, without fabricating account names. */
function reads() {
  return vi.fn<typeof fetch>(async (url) =>
    String(url).endsWith('/balance')
      ? jsonResponse({ data: { account_id: accountId, balance: '10.00' } })
      : jsonResponse({
          data: [],
          pagination: { page: 1, limit: 20, total_records: 0, total_pages: 0 },
        }),
  );
}
/** Uses actual route composition to exercise shared header/landing selection. */
function page(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('account selection and logging out', () => {
  it('retains selection across home/reload, hides creation, logs out without erasing unresolved commands, and reopens by ID', async () => {
    vi.stubGlobal('fetch', reads());
    savePendingIntent(accountId, command);
    saveTransferIntent(accountId, transfer);
    const view = page(`/accounts/${accountId.toUpperCase()}`);
    await screen.findByTestId('account-balance');
    expect(await screen.findByRole('button', { name: 'Log out' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Transaction Ledger home' }));
    expect(screen.queryByLabelText('Account name')).not.toBeInTheDocument();
    expect(screen.getByText('Your account is ready')).toBeInTheDocument();
    view.unmount();
    page('/');
    expect(screen.getByText('Your account is ready')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(screen.getByText('Logged out')).toBeInTheDocument();
    expect(screen.getByLabelText('Account name')).toBeInTheDocument();
    expect(readPendingIntent(accountId)).toEqual(command);
    expect(readTransferIntent(accountId)).toEqual(transfer);
    await userEvent.type(screen.getByLabelText('Account ID'), accountId);
    await userEvent.click(screen.getByRole('button', { name: 'Open account' }));
    await screen.findByTestId('account-balance');
    expect(screen.getByRole('button', { name: 'Retry same request' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry same transfer' })).toBeInTheDocument();
  });
  it('does not steal focus if account entry begins before deferred route focus runs', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('fetch', reads());
    page(`/accounts/${accountId}`);
    await screen.findByTestId('account-balance');
    await userEvent.click(screen.getByRole('link', { name: 'Transaction Ledger home' }));
    const input = screen.getByLabelText('Account ID');
    input.focus();
    act(() => frames.at(-1)?.(0));
    expect(input).toHaveFocus();
  });
  it('forgets a restored account after authoritative not-found without showing write controls', async () => {
    sessionStorage.setItem('transaction-ledger:active-account', JSON.stringify({ id: accountId }));
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        jsonResponse(
          {
            error: {
              code: 'ACCOUNT_NOT_FOUND',
              message: 'Account not found',
              support_ticket_id: '11111111-1111-4111-8111-111111111111',
              action: 'fix_input',
            },
          },
          404,
        ),
      ),
    );
    page(`/accounts/${accountId}`);
    await screen.findByRole('alert');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole('form', { name: 'New transaction' })).not.toBeInTheDocument();
    expect(sessionStorage.getItem('transaction-ledger:active-account')).toBeNull();
  });
});

describe('HTTP response correlation', () => {
  it('rejects a balance from a different account', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        jsonResponse({ data: { account_id: other, balance: '10.00' } }),
      ),
    );
    await expect(getAccountBalance(accountId, new AbortController().signal)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
  it.each(['account_id', 'amount', 'type', 'reference_id', 'description'] as const)(
    'keeps a mismatched transaction %s uncertain',
    async (field) => {
      const entry = {
        ...transactionResponse.data.transaction,
        ...command,
        [field]: {
          account_id: other,
          amount: '2.00',
          type: 'debit',
          reference_id: 'different',
          description: 'different',
        }[field],
      };
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>(async () =>
          jsonResponse({ data: { ...transactionResponse.data, transaction: entry } }, 201),
        ),
      );
      await expect(createTransaction(accountId, command)).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
        uncertain: true,
      });
    },
  );
  it.each(['account', 'filter', 'page', 'limit'])(
    'rejects history for the wrong %s',
    async (kind) => {
      const entry = {
        ...transactionResponse.data.transaction,
        account_id: kind === 'account' ? other : accountId,
        type: kind === 'filter' ? 'debit' : 'credit',
      };
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>(async () =>
          jsonResponse({
            data: [entry],
            pagination: {
              page: kind === 'page' ? 2 : 1,
              limit: kind === 'limit' ? 10 : 20,
              total_records: 21,
              total_pages: kind === 'limit' ? 3 : 2,
            },
          }),
        ),
      );
      await expect(
        getTransactionHistory(
          accountId,
          { page: 1, limit: 20, type: 'credit' },
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    },
  );
});

describe('write/read safety', () => {
  it('blocks credit/debit before HTTP when retry storage fails', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      render(<TransactionForm accountId={accountId} onChanged={() => {}} />);
      await userEvent.type(screen.getByLabelText('Amount'), '1');
      await userEvent.click(screen.getByRole('button', { name: 'Add credit' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Retry details could not be saved',
      );
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      set.mockRestore();
    }
  });
  it('focuses an invalid description instead of the valid amount', async () => {
    render(<TransactionForm accountId={accountId} onChanged={() => {}} />);
    await userEvent.type(screen.getByLabelText('Amount'), '1');
    fireEvent.change(screen.getByLabelText('Description (optional)'), {
      target: { value: 'x'.repeat(501) },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Add credit' }));
    expect(screen.getByLabelText('Description (optional)')).toHaveFocus();
  });
  it('preserves an earlier uncertain credit across local retry configuration failure and UUID casing', async () => {
    savePendingIntent(accountId, command);
    vi.stubEnv('VITE_API_BASE_URL', 'invalid');
    try {
      const { result } = renderHook(() => useTransactionIntent(accountId.toUpperCase(), vi.fn()));
      expect(result.current.phase).toBe('uncertain');
      await act(() => result.current.send(command));
      expect(result.current.phase).toBe('uncertain');
      expect(readPendingIntent(accountId)).toEqual(command);
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('preserves an earlier uncertain transfer across local retry configuration failure', async () => {
    saveTransferIntent(accountId, transfer);
    vi.stubEnv('VITE_API_BASE_URL', 'invalid');
    try {
      const { result } = renderHook(() => useTransferIntent(accountId, vi.fn()));
      await act(() => result.current.send());
      expect(result.current.phase).toBe('uncertain');
      expect(readTransferIntent(accountId)).toEqual(transfer);
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('removes stale balance data after a definitive not-found refresh', async () => {
    const fetcher = reads();
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(() => useAccount(accountId));
    await waitFor(() => expect(result.current.data).toBeDefined());
    fetcher.mockImplementation(async () =>
      jsonResponse(
        {
          error: {
            code: 'ACCOUNT_NOT_FOUND',
            message: 'Account not found',
            support_ticket_id: '11111111-1111-4111-8111-111111111111',
            action: 'fix_input',
          },
        },
        404,
      ),
    );
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.error?.code).toBe('ACCOUNT_NOT_FOUND'));
    expect(result.current.data).toBeUndefined();
  });
});
