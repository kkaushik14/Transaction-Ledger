/** Behavior contracts for reusable controls are checked before sections/pages consume them. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import {
  Button,
  ButtonLink,
  TextField,
  TextAreaField,
  SelectField,
  StatusMessage,
  Pagination,
  IconButton,
} from '../src/components/ui/index.js';

describe('UI primitives', () => {
  it('blocks activation and announces busy state during a pending action', async () => {
    const click = vi.fn();
    render(
      <Button loading onClick={click}>
        Sending
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Sending' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(click).not.toHaveBeenCalled();
  });
  it('keeps CTA links as navigable anchors', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/#get-started">Create an account</ButtonLink>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/#get-started');
  });
  it('associates labels, hints and errors with their native controls', () => {
    render(
      <>
        <TextField label="Amount" hint="Decimal string" error="Amount is required" />
        <TextAreaField label="Description" />
        <SelectField label="Type">
          <option>Credit</option>
        </SelectField>
      </>,
    );
    expect(screen.getByLabelText('Amount')).toHaveAccessibleDescription(
      'Decimal string Amount is required',
    );
    expect(screen.getByLabelText('Amount')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Description')).toBeInstanceOf(HTMLTextAreaElement);
    expect(screen.getByRole('combobox', { name: 'Type' })).toBeInTheDocument();
  });
  it('gives icon-only actions a real accessible name', () => {
    render(<IconButton label="Copy account ID" icon="copy" />);
    expect(screen.getByRole('button', { name: 'Copy account ID' })).toBeInTheDocument();
  });
  it('communicates non-error updates through a polite status', () => {
    render(
      <StatusMessage tone="info" title="Request failed">
        Try again
      </StatusMessage>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Request failedTry again');
  });
  it('uses server page boundaries and descriptive navigation', async () => {
    const change = vi.fn();
    render(<Pagination page={1} totalPages={2} totalRecords={23} onPageChange={change} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(change).toHaveBeenCalledExactlyOnceWith(2);
  });
  it('disables both page controls when there are no matching records', () => {
    render(<Pagination page={1} totalPages={0} totalRecords={0} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  });
});
