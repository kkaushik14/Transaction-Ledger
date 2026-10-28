/** Real PostgreSQL commits plus the real browser's 20-second AbortController timeout and saved retries. */
import { expect, test, type APIRequestContext } from '@playwright/test';
const api = 'http://127.0.0.1:4310/api/v1';
/** Seeds only the disposable fixture, through public APIs, with exact known balances. */
async function account(request: APIRequestContext, amount: string): Promise<string> {
  const created = await request.post(`${api}/accounts`, {
    data: { name: 'Isolated timeout audit' },
  });
  expect(created.status()).toBe(201);
  const id: string = (await created.json()).data.id;
  const funded = await request.post(`${api}/accounts/${id}/transactions`, {
    data: { type: 'credit', amount, reference_id: 'funding' },
  });
  expect(funded.status()).toBe(201);
  return id;
}

for (const kind of ['credit', 'debit', 'transfer'] as const)
  test(`${kind}: commit before a client timeout, reload and identical retry never double-apply or show false success`, async ({
    page,
    request,
  }) => {
    const source = await account(request, '100.00'),
      destination = await account(request, '10.00');
    const path = kind === 'transfer' ? '/transfers' : `/accounts/${source}/transactions`;
    const payloads: { reference_id: string }[] = [];
    let committed: () => void = () => {};
    let releaseResponse: () => void = () => {};
    const commitObserved = new Promise<void>((resolve) => {
      committed = resolve;
    });
    const heldResponse = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    await page.route(`**/api/v1${path}`, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      payloads.push(route.request().postDataJSON());
      if (payloads.length === 1) {
        // route.fetch reaches the actual API/database and finishes COMMIT. Withhold
        // only delivery to the browser, then let apiRequest's own deadline abort it.
        expect((await route.fetch()).status()).toBe(201);
        committed();
        await heldResponse;
        await route.abort('timedout');
      } else await route.continue();
    });
    try {
      await page.goto(`/accounts/${source}`);
      await expect(page.getByTestId('account-balance')).toHaveText('100.00');
      await expect(page.getByRole('region', { name: 'Transaction history' })).toHaveAttribute(
        'aria-busy',
        'false',
      );
      await page.clock.install();
      const form = page.getByRole('form', {
        name: kind === 'transfer' ? 'Transfer between accounts' : 'New transaction',
      });
      if (kind === 'transfer') {
        await form.getByLabel('Destination account ID').fill(destination);
        await form.getByLabel('Transfer amount', { exact: true }).fill('20.00');
        await form.getByRole('button', { name: 'Review transfer' }).click();
        await form.getByRole('button', { name: 'Confirm transfer' }).click();
      } else {
        await form.getByLabel('Transaction type').selectOption(kind);
        await form.getByLabel('Amount', { exact: true }).fill('20.00');
        await form.getByRole('button', { name: `Add ${kind}`, exact: true }).click();
      }
      await commitObserved;
      await page.clock.fastForward(20001);
      const notice = form.getByRole('alert');
      await expect(notice).toContainText('NETWORK_ERROR');
      await expect(notice).toContainText(/unconfirmed|not confirmed/);
      await expect(notice).toContainText(/may already be recorded/);
      await expect(notice).not.toContainText(/rolled back|definitely failed|AbortError/);
      await expect(form.getByText(/Credit recorded|Debit recorded|Transfer complete/)).toHaveCount(
        0,
      );
      const expectedBalance = kind === 'credit' ? '120.00' : '80.00';
      expect(
        (await (await request.get(`${api}/accounts/${source}/balance`)).json()).data.balance,
      ).toBe(expectedBalance);
      releaseResponse();
      await page.reload();
      const retry = page.getByRole('button', {
        name: kind === 'transfer' ? 'Retry same transfer' : 'Retry same request',
      });
      await expect(retry).toBeVisible();
      expect(payloads).toHaveLength(1); // Reload never automatically resubmits.
      const conflict = page.waitForResponse(
        (response) => response.request().method() === 'POST' && response.url().endsWith(path),
      );
      await retry.click();
      const response = await conflict;
      expect(response.status()).toBe(409);
      const { error } = await response.json();
      await expect(form.getByRole('alert')).toContainText(error.support_ticket_id);
      await expect(form.getByRole('alert')).toContainText(
        kind === 'transfer' ? 'DUPLICATE_TRANSFER' : 'DUPLICATE_TRANSACTION',
      );
      await expect(form.getByText(/Credit recorded|Debit recorded|Transfer complete/)).toHaveCount(
        0,
      );
      expect(payloads).toHaveLength(2);
      expect(payloads[1]).toEqual(payloads[0]);
      await expect(page.getByTestId('account-balance')).toHaveText(expectedBalance);
      for (const id of kind === 'transfer' ? [source, destination] : [source]) {
        const history = await request.get(`${api}/accounts/${id}/transactions?limit=100`);
        const body = await history.json();
        expect(body.pagination.total_records).toBe(2);
        expect(
          body.data.filter(
            (row: { reference_id: string }) => row.reference_id === payloads[0]?.reference_id,
          ),
        ).toHaveLength(1);
      }
      if (kind === 'transfer')
        expect(
          (await (await request.get(`${api}/accounts/${destination}/balance`)).json()).data.balance,
        ).toBe('30.00');
    } finally {
      releaseResponse();
    }
  });
