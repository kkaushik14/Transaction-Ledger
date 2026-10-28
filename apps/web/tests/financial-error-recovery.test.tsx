/** Runs the real transaction HTTP timeout through the form, saved intent and centralized error UI. */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveErrorMessage } from '@ledger/contracts';
import { TransactionForm } from '../src/features/transactions/index.js';
import { readPendingIntent } from '../src/features/transactions/hooks/index.js';
import { getErrorDiagnostics } from '../src/errors/index.js';
import { accountId, jsonResponse, transactionResponse } from './fixtures';
afterEach(() => vi.useRealTimers());

describe('critical: actual client timeout and explicit retry', () => {
  it.each(['credit', 'debit'] as const)(
    '%s timeout retains the original command and never displays a false failure or success',
    async (type) => {
      vi.useFakeTimers();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      let first = true;
      const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
        if (first) {
          first = false;
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () =>
                reject(new DOMException('Actual client timer aborted the response', 'AbortError')),
              { once: true },
            );
          });
        }
        return jsonResponse(
          {
            data: {
              ...transactionResponse.data,
              account_balance: type === 'credit' ? '101.50' : '98.50',
              transaction: {
                ...transactionResponse.data.transaction,
                ...JSON.parse(String(init?.body)),
              },
            },
          },
          201,
        );
      });
      vi.stubGlobal('fetch', fetcher);
      const refreshed = vi.fn();
      render(<TransactionForm accountId={accountId} onChanged={refreshed} />);
      fireEvent.change(screen.getByLabelText('Transaction type'), { target: { value: type } });
      fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1.50' } });
      fireEvent.change(screen.getByLabelText('Description (optional)'), {
        target: { value: 'Preserve this exact command' },
      });
      fireEvent.submit(screen.getByRole('form', { name: 'New transaction' }));
      expect(fetcher).toHaveBeenCalledTimes(1);
      const original: unknown = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20001);
      });
      const notice = screen.getByRole('alert');
      expect(notice).toHaveTextContent('NETWORK_ERROR');
      expect(notice).toHaveTextContent(
        resolveErrorMessage('NETWORK_ERROR', 'transaction', true).message,
      );
      const supportId = notice.querySelectorAll('code')[1]?.textContent ?? '';
      expect(supportId).toMatch(/^[0-9a-f-]{36}$/);
      expect(getErrorDiagnostics(supportId)).not.toHaveLength(0);
      expect(notice.textContent).not.toMatch(
        /Actual client timer|AbortError|rolled back|definitely failed/i,
      );
      expect(screen.queryByText(/Credit recorded|Debit recorded/)).not.toBeInTheDocument();
      expect(screen.getByLabelText('Amount')).toBeDisabled();
      expect(refreshed).not.toHaveBeenCalled();
      expect(readPendingIntent(accountId)).toEqual(original);
      // Recovery is explicit: waiting longer cannot create another POST or reference.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(40000);
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Retry same request' }));
      });
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual(original);
      expect(
        screen.getByText(type === 'credit' ? 'Credit recorded' : 'Debit recorded'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(readPendingIntent(accountId)).toBeUndefined();
      expect(refreshed).toHaveBeenCalledTimes(1);
    },
  );
});
