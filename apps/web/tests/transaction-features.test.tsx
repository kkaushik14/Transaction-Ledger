/** Write-intent safety and responsive history controls are tested before account-page assembly. */
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TransactionForm, TransactionHistory } from '../src/features/transactions/index.js';
import { readPendingIntent } from '../src/features/transactions/hooks/index.js';

import { accountId, transactionResponse, jsonResponse } from './fixtures';
/** Fills a simple valid credit while leaving the generated reference under component control. */
async function fill() {
  await userEvent.type(screen.getByLabelText('Amount'), '1.5');
}

describe('transaction intent', () => {
  it('validates input before sending', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    render(<TransactionForm accountId={accountId} onChanged={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add credit' }));
    expect(screen.getByLabelText('Amount')).toHaveAttribute('aria-invalid', 'true');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('normalizes amount, sends one request, and refreshes authoritative data', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => jsonResponse(transactionResponse, 201));
    const changed = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    render(<TransactionForm accountId={accountId} onChanged={changed} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Add credit' }));
    expect(await screen.findByText('Credit recorded')).toBeInTheDocument();
    expect(changed).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(payload.amount).toBe('1.50');
    expect(payload.reference_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(screen.getByLabelText('Amount')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'New transaction' })).toBeInTheDocument();
  });
  it('blocks duplicate form submission while the request is pending', async () => {
    let resolve: ((response: Response) => void) | undefined;
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    vi.stubGlobal('fetch', fetcher);
    render(<TransactionForm accountId={accountId} onChanged={() => {}} />);
    await fill();
    const form = screen.getByRole('form', { name: 'New transaction' });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Recording credit…' })).toBeDisabled();
    resolve?.(jsonResponse(transactionResponse, 201));
    expect(await screen.findByText('Credit recorded')).toBeInTheDocument();
  });
  it.each([
    ['INSUFFICIENT_BALANCE', 'Account has insufficient balance'],
    ['BALANCE_LIMIT_EXCEEDED', 'Credit would exceed the maximum account balance'],
  ])('handles %s without clearing form context', async (code, message) => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => jsonResponse({ error: { code, message, details: {} } }, 422)),
    );
    const changed = vi.fn();
    render(<TransactionForm accountId={accountId} onChanged={changed} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Add credit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByLabelText('Amount')).toHaveValue('1.5');
    expect(screen.getByLabelText('Amount')).toBeEnabled();
    expect(changed).not.toHaveBeenCalled();
  });
  it('preserves an uncertain payload/reference across remount and retries it unchanged', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new TypeError('offline');
    });
    vi.stubGlobal('fetch', fetcher);
    const first = render(<TransactionForm accountId={accountId} onChanged={() => {}} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Add credit' }));
    expect(await screen.findByText('Result not confirmed')).toBeInTheDocument();
    const original = String(fetcher.mock.calls[0]?.[1]?.body);
    first.unmount();
    fetcher.mockImplementation(async () => jsonResponse(transactionResponse, 201));
    const changed = vi.fn();
    render(<TransactionForm accountId={accountId} onChanged={changed} />);
    expect(screen.getByLabelText('Amount')).toHaveValue('1.50');
    expect(screen.getByLabelText('Amount')).toBeDisabled();
    expect(fetcher).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Retry same request' }));
    expect(await screen.findByText('Credit recorded')).toBeInTheDocument();
    expect(String(fetcher.mock.calls[1]?.[1]?.body)).toBe(original);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(sessionStorage.length).toBe(0);
  });
  it('handles duplicate conflicts without automatically making a fresh movement', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      jsonResponse(
        {
          error: { code: 'DUPLICATE_TRANSACTION', message: 'Reference already used', details: {} },
        },
        409,
      ),
    );
    vi.stubGlobal('fetch', fetcher);
    const changed = vi.fn();
    render(<TransactionForm accountId={accountId} onChanged={changed} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Add credit' }));
    expect(await screen.findByText('Reference already used')).toBeInTheDocument();
    expect(changed).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Amount')).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'New transaction' }));
    expect(screen.getByLabelText('Amount')).toHaveValue('');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not let an old form response erase a newer pending intent after navigation', async () => {
    const finish: ((response: Response) => void)[] = [];
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish.push(resolve);
        }),
    );
    vi.stubGlobal('fetch', fetcher);
    const first = render(<TransactionForm accountId={accountId} onChanged={() => {}} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Add credit' }));
    first.unmount();
    render(<TransactionForm accountId={accountId} onChanged={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Start a different transaction' }));
    await userEvent.type(screen.getByLabelText('Amount'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Add credit' }));
    const latest = readPendingIntent(accountId);
    expect(latest?.amount).toBe('2.00');
    await act(async () => {
      finish[0]?.(jsonResponse(transactionResponse, 201));
    });
    expect(readPendingIntent(accountId)).toEqual(latest);
    await act(async () => {
      finish[1]?.(jsonResponse(transactionResponse, 201));
    });
    expect(readPendingIntent(accountId)).toBeUndefined();
  });
});

describe('transaction history component', () => {
  const entry = transactionResponse.data.transaction;
  const data = {
    data: [entry],
    pagination: { page: 1, limit: 20, total_records: 21, total_pages: 2 },
  };
  it('preserves details in table and narrow-screen card representations with filter/page controls', async () => {
    const filter = vi.fn(),
      page = vi.fn();
    render(
      <TransactionHistory
        data={data}
        loading={false}
        error={undefined}
        filter="all"
        onFilter={filter}
        onPage={page}
        onRetry={() => {}}
      />,
    );
    expect(within(screen.getByRole('table')).getByText(entry.reference_id)).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Transaction entries' })).getByText(entry.id),
    ).toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Filter by type' }),
      'debit',
    );
    expect(filter).toHaveBeenCalledExactlyOnceWith('debit');
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(page).toHaveBeenCalledExactlyOnceWith(2);
  });
  it('distinguishes an empty filtered result from loading or failure', () => {
    render(
      <TransactionHistory
        data={{ data: [], pagination: { page: 1, limit: 20, total_records: 0, total_pages: 0 } }}
        loading={false}
        error={undefined}
        filter="debit"
        onFilter={() => {}}
        onPage={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByText('No matching transactions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });
});
