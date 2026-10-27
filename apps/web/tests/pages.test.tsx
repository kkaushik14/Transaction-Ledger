/** Integrated route compositions verify API orchestration while reusing completed components. */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { AppRoutes } from '../src/app/routes';
import { accountId, jsonResponse } from './fixtures';
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
  });
  it('recovers from an unknown account without a fabricated balance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        jsonResponse(
          { error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found', details: {} } },
          404,
        ),
      ),
    );
    page(`/accounts/${accountId}`);
    expect(await screen.findByRole('alert')).toHaveTextContent('Account not found');
    expect(screen.queryByTestId('account-balance')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open another account' })).toHaveAttribute(
      'href',
      '/#get-started',
    );
  });
  it('does not query APIs for invalid UUID routes and provides recovery', () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    page('/accounts/invalid');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'This account ID is not valid.',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('provides a real not-found route inside the shared shell', () => {
    page('/not-a-real-route');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'We couldn’t find that page.',
    );
    expect(screen.getByRole('link', { name: 'Back to overview' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
