/** Account features are verified independently before the landing/account pages consume them. */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import {
  AccountCreateForm,
  AccountLookupForm,
  AccountPageHeader,
  AccountBalanceCard,
} from '../src/features/accounts/index.js';

import { accountId, accountResponse, jsonResponse } from './fixtures';
/** Destination fixture makes navigation state observable without composing a real page. */
function Destination() {
  const location = useLocation();
  return (
    <output>
      {location.pathname} {JSON.stringify(location.state)}
    </output>
  );
}
/** Wraps one independent form and a navigation-only destination fixture. */
function FormRoute({ lookup = false }: { lookup?: boolean }) {
  return (
    <MemoryRouter>
      <Routes>
        <Route path="/" element={lookup ? <AccountLookupForm /> : <AccountCreateForm />} />
        <Route path="/accounts/:id" element={<Destination />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('account feature components', () => {
  it('rejects blank names before HTTP and focuses the invalid field', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    render(<FormRoute />);
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByLabelText('Account name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Account name')).toHaveFocus();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('creates a name-only account and navigates with its known name', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => jsonResponse(accountResponse, 201));
    vi.stubGlobal('fetch', fetcher);
    render(<FormRoute />);
    await userEvent.type(screen.getByLabelText('Account name'), '  Alex Morgan  ');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(accountId));
    expect(screen.getByRole('status')).toHaveTextContent('Alex Morgan');
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({ name: 'Alex Morgan' });
  });
  it('validates UUID lookup and navigates without fabricating a name', async () => {
    render(<FormRoute lookup />);
    await userEvent.click(screen.getByRole('button', { name: 'Open account' }));
    expect(screen.getByText('Enter a valid Account ID.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Account ID'), accountId);
    await userEvent.click(screen.getByRole('button', { name: 'Open account' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(`/accounts/${accountId} null`),
    );
  });
  it('does not navigate back when creation completes after the user leaves the form', async () => {
    let finish: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <MemoryRouter>
        <Link to="/elsewhere">Leave account entry</Link>
        <Routes>
          <Route path="/" element={<AccountCreateForm />} />
          <Route path="/elsewhere" element={<h1>Another destination</h1>} />
          <Route path="/accounts/:id" element={<Destination />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText('Account name'), 'Alex Morgan');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await userEvent.click(screen.getByRole('link', { name: 'Leave account entry' }));
    await act(async () => {
      finish?.(jsonResponse(accountResponse, 201));
    });
    expect(screen.getByRole('heading', { name: 'Another destination' })).toBeInTheDocument();
  });
  it('uses the approved Account/UUID fallback and an exact large balance', () => {
    render(
      <MemoryRouter>
        <AccountPageHeader accountId={accountId} />
        <AccountBalanceCard balance="999999999999999999.99" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Account' })).toBeInTheDocument();
    expect(screen.getByText(accountId)).toBeInTheDocument();
    expect(screen.getByTestId('account-balance')).toHaveTextContent('999999999999999999.99');
  });
});
