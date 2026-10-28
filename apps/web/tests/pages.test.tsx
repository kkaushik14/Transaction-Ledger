/** Integrated route compositions verify API orchestration while reusing completed components. */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { AppRoutes } from '../src/app/index.js';
import { accountId, jsonResponse } from './fixtures';
import type { CreateTransferRequest } from '@ledger/contracts';
/** Renders actual routes with a controlled location and contract-valid HTTP fixtures. */
function page(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('page composition', () => {
  it('composes all required landing landmarks, sections, and real entry controls', () => {
    page('/');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    for (const anchor of ['features', 'how-it-works', 'get-started'])
      expect(document.getElementById(anchor)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'A clear view of every transaction.',
    );
    expect(screen.getByLabelText('Account name')).toBeInTheDocument();
    expect(screen.getByLabelText('Account ID')).toBeInTheDocument();
  });
  it('loads the selected account and an empty history with the UUID/name fallback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input) =>
        String(input).endsWith('/balance')
          ? jsonResponse({ data: { account_id: accountId, balance: '100.00' } })
          : jsonResponse({
              data: [],
              pagination: { page: 1, limit: 20, total_records: 0, total_pages: 0 },
            }),
      ),
    );
    page(`/accounts/${accountId}`);
    expect(screen.getByRole('heading', { level: 1, name: 'Account' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('account-balance')).toHaveTextContent('100.00'));
    expect(await screen.findByText('No transactions yet')).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'New transaction' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Transfer between accounts' })).toBeInTheDocument();
  });
  it('keeps a committed receipt through read failure and retries only the balance read', async () => {
    const destination = 'bbbbbbbb-0000-4000-8000-000000000002';
    let balanceReads = 0,
      writes = 0;
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      if (init?.method === 'POST') {
        writes++;
        const command: CreateTransferRequest = JSON.parse(String(init.body));
        const transferId = 'cccccccc-0000-4000-8000-000000000003';
        const leg = {
          amount: command.amount,
          reference_id: command.reference_id,
          description: command.description,
          transfer_id: transferId,
          created_at: '2026-10-28T00:00:00.000Z',
        };
        return jsonResponse(
          {
            data: {
              transfer: { ...command, id: transferId, created_at: leg.created_at },
              debit: {
                ...leg,
                id: 'dddddddd-0000-4000-8000-000000000004',
                account_id: accountId,
                type: 'debit',
              },
              credit: {
                ...leg,
                id: 'eeeeeeee-0000-4000-8000-000000000005',
                account_id: destination,
                type: 'credit',
              },
              source_account_balance: '8.50',
              destination_account_balance: '1.50',
            },
          },
          201,
        );
      }
      if (String(url).endsWith('/balance')) {
        balanceReads++;
        if (balanceReads === 2) throw new TypeError('Read unavailable');
        return jsonResponse({
          data: { account_id: accountId, balance: balanceReads === 1 ? '10.00' : '8.50' },
        });
      }
      return jsonResponse({
        data: [],
        pagination: { page: 1, limit: 20, total_records: 0, total_pages: 0 },
      });
    });
    vi.stubGlobal('fetch', fetcher);
    page(`/accounts/${accountId}`);
    const transfer = within(await screen.findByRole('form', { name: 'Transfer between accounts' }));
    await userEvent.type(transfer.getByLabelText('Destination account ID'), destination);
    await userEvent.type(transfer.getByLabelText('Transfer amount'), '1.50');
    await userEvent.click(transfer.getByRole('button', { name: 'Review transfer' }));
    await userEvent.click(transfer.getByRole('button', { name: 'Confirm transfer' }));
    expect(await screen.findByText(/Balance refresh failed/)).toBeInTheDocument();
    expect(transfer.getByText('Transfer complete')).toBeInTheDocument();
    expect(screen.getByTestId('account-balance')).toHaveTextContent('10.00');
    expect(screen.getByText('Last confirmed balance')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry balance' }));
    await waitFor(() => expect(screen.getByTestId('account-balance')).toHaveTextContent('8.50'));
    expect(writes).toBe(1);
    expect(transfer.getByText('Transfer complete')).toBeInTheDocument();
  });
  it('recovers from an unknown account without a fabricated balance', async () => {
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
    expect(await screen.findByRole('alert')).toHaveTextContent('Account not found');
    expect(screen.queryByTestId('account-balance')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go Back' })).toBeInTheDocument();
  });
  it('does not query APIs for invalid UUID routes and provides recovery', () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    page('/accounts/invalid');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid Account ID');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('provides a real not-found route inside the shared shell', () => {
    page('/not-a-real-route');
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t find that page.');
    expect(screen.getByRole('button', { name: 'Go Back' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
