/** Read cancellation, filter pagination resets, and stale-response protection without page composition. */
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useAccount } from '../src/features/accounts/index.js';
import { useTransactions } from '../src/features/transactions/index.js';
import { accountId, jsonResponse } from './fixtures';

describe('read orchestration', () => {
  it('retains last confirmed data on refresh failure but never carries it into another identity', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      jsonResponse({ data: { account_id: accountId, balance: '1.00' } }),
    );
    vi.stubGlobal('fetch', fetcher);
    const view = renderHook(({ id }) => useAccount(id), { initialProps: { id: accountId } });
    await waitFor(() => expect(view.result.current.data?.data.balance).toBe('1.00'));
    fetcher.mockImplementation(async () => {
      throw new TypeError('offline');
    });
    act(() => view.result.current.refresh());
    await waitFor(() => expect(view.result.current.error?.code).toBe('NETWORK_ERROR'));
    expect(view.result.current.data?.data.balance).toBe('1.00');
    view.rerender({ id: 'bbbbbbbb-0000-4000-8000-000000000002' });
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.data).toBeUndefined();
  });
  it('ignores a stale balance after the selected account changes', async () => {
    let resolve: ((response: Response) => void) | undefined;
    let oldSignal: AbortSignal | undefined;
    const other = '64c7dc4e-509c-460b-9175-c79503c4f4c6';
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      oldSignal = init?.signal ?? undefined;
      return new Promise<Response>((done) => {
        resolve = done;
      });
    });
    vi.stubGlobal('fetch', fetcher);
    const view = renderHook(({ id }) => useAccount(id), { initialProps: { id: accountId } });
    fetcher.mockImplementation(async () =>
      jsonResponse({ data: { account_id: other, balance: '2.00' } }),
    );
    view.rerender({ id: other });
    await waitFor(() => expect(view.result.current.data?.data.account_id).toBe(other));
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => {
      resolve?.(jsonResponse({ data: { account_id: accountId, balance: '1.00' } }));
    });
    expect(view.result.current.data?.data.account_id).toBe(other);
  });
  it('resets the page when the type filter changes and serializes only real API parameters', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      jsonResponse({
        data: [],
        pagination: { page: 1, limit: 20, total_records: 0, total_pages: 0 },
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(() => useTransactions(accountId));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.changePage(2));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    act(() => result.current.changeFilter('debit'));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    expect(result.current.page).toBe(1);
    expect(String(fetcher.mock.calls[2]?.[0])).toContain('page=1&limit=20&type=debit');
    expect(String(fetcher.mock.calls[0]?.[0])).not.toContain('type=all');
  });
});
