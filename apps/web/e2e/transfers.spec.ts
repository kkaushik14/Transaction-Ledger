/** Real transfer UI flows use the disposable API/PostgreSQL fixture, never the configured hosted database. */
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const api = 'http://127.0.0.1:4310/api/v1';
/** Creates a local account and optionally funds it via the real transaction endpoint. */
async function account(request: APIRequestContext, amount?: string) {
  const created = await request.post(`${api}/accounts`, { data: { name: 'Transfer browser QA' } });
  expect(created.status()).toBe(201);
  const id: string = (await created.json()).data.id;
  if (amount)
    expect(
      (
        await request.post(`${api}/accounts/${id}/transactions`, {
          data: { type: 'credit', amount, reference_id: 'funding' },
        })
      ).status(),
    ).toBe(201);
  return id;
}
/** Exercises actual field entry and review while leaving the generated reference unchanged. */
async function review(page: Page, destination: string, amount = '1.50') {
  const form = page.getByRole('form', { name: 'Transfer between accounts' });
  await form.getByLabel('Destination account ID').fill(destination);
  await form.getByLabel('Transfer amount').fill(amount);
  await form.getByLabel('Transfer description (optional)').fill('Shared expense');
  await form.getByRole('button', { name: 'Review transfer' }).click();
  return form;
}
/** Asserts real layouts fit instead of masking defects with overflow-x:hidden. */
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.body.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
/** Reads only fixture balances for authoritative success/failure assertions. */
async function balance(request: APIRequestContext, id: string) {
  const response = await request.get(`${api}/accounts/${id}/balance`);
  return (await response.json()).data.balance;
}

test('transfer review, receipt, source refresh, pagination reset and recipient history work at all required widths', async ({
  page,
  request,
}, info) => {
  const source = await account(request),
    destination = await account(request);
  for (let i = 0; i < 21; i++) {
    expect(
      (
        await request.post(`${api}/accounts/${source}/transactions`, {
          data: { type: 'credit', amount: '1.00', reference_id: `seed-${i}` },
        })
      ).status(),
    ).toBe(201);
  }
  await page.goto(`/accounts/${source}`);
  await page.getByLabel('Filter by type').selectOption('credit');
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('21 transactions · Page 2 of 2')).toBeVisible();
  const form = await review(page, destination.toUpperCase());
  await expect(form.getByRole('heading', { name: 'Review transfer' })).toBeFocused();
  expect(await balance(request, source)).toBe('21.00');
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await noOverflow(page);
  }
  await form.getByRole('heading', { name: 'Review transfer' }).focus();
  await page.keyboard.press('Tab');
  await expect(form.getByRole('button', { name: 'Confirm transfer' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(form.getByText('Transfer complete', { exact: true })).toBeVisible();
  await expect(page.getByTestId('account-balance')).toHaveText('19.50');
  await expect(page.getByText('21 transactions · Page 1 of 2')).toBeVisible();
  await expect(page.getByLabel('Filter by type')).toHaveValue('credit');
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await noOverflow(page);
    if (width === 375 || width === 1440) {
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
      ).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`transfer-receipt-${width}.png`),
        fullPage: true,
      });
    }
  }
  await page.getByLabel('Filter by type').selectOption('debit');
  await expect(page.locator('.history-table')).toContainText('Shared expense');
  expect(await balance(request, destination)).toBe('1.50');
  await form.getByRole('link', { name: 'Open destination account' }).click();
  await expect(page).toHaveURL(`/accounts/${destination}`);
  await expect(page.getByTestId('account-balance')).toHaveText('1.50');
  await expect(page.locator('.history-table')).toContainText('Shared expense');
});

test('a committed transfer with a lost response restores and retries the exact intent without moving funds twice', async ({
  page,
  request,
}, info) => {
  const source = await account(request, '2.00'),
    destination = await account(request);
  let first = true;
  const bodies: unknown[] = [];
  await page.route('**/api/v1/transfers', async (route) => {
    bodies.push(route.request().postDataJSON());
    if (first) {
      first = false;
      expect((await route.fetch()).status()).toBe(201);
      await route.abort('failed');
    } else await route.continue();
  });
  await page.goto(`/accounts/${source}`);
  let form = await review(page, destination);
  await form.getByRole('button', { name: 'Confirm transfer' }).click();
  await expect(form.getByText('Transfer result unconfirmed')).toBeVisible();
  await expect(form.getByLabel('Transfer amount')).toHaveCount(0);
  await page.reload();
  form = page.getByRole('form', { name: 'Transfer between accounts' });
  await expect(form.getByRole('button', { name: 'Retry same transfer' })).toBeVisible();
  expect(bodies).toHaveLength(1);
  await form.getByRole('button', { name: 'Retry same transfer' }).click();
  await expect(form.getByText('Transfer reference already used')).toBeVisible();
  await expect(form.getByText('Transfer complete')).toHaveCount(0);
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual(bodies[1]);
  await expect(page.getByTestId('account-balance')).toHaveText('0.50');
  expect(await balance(request, destination)).toBe('1.50');
  const history = await request.get(`${api}/accounts/${source}/transactions?type=debit`);
  expect((await history.json()).pagination.total_records).toBe(1);
  await form.getByRole('button', { name: 'Refresh account' }).click();
  expect(bodies).toHaveLength(2);
  await expect(form.getByRole('button', { name: 'New transfer' })).toBeDisabled();
  await page.setViewportSize({ width: 375, height: 1000 });
  await noOverflow(page);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('transfer-conflict-mobile.png'), fullPage: true });
  await form.getByRole('checkbox').check();
  await form.getByRole('button', { name: 'New transfer' }).click();
  await expect(form.getByLabel('Transfer amount')).toHaveValue('');
  expect(bodies).toHaveLength(2);
});

test('known destination and balance errors preserve editable fields and leave both accounts unchanged', async ({
  page,
  request,
}) => {
  const source = await account(request, '2.00'),
    full = await account(request, '999999999999999999.99');
  await page.goto(`/accounts/${source}`);
  const form = await review(page, full);
  await form.getByRole('button', { name: 'Confirm transfer' }).click();
  await expect(form.getByRole('alert')).toContainText('destination balance limit');
  await expect(form.getByLabel('Transfer amount')).toHaveValue('1.50');
  await form.getByLabel('Destination account ID').fill('aaaaaaaa-0000-4000-8000-000000000001');
  await form.getByRole('button', { name: 'Review transfer' }).click();
  await form.getByRole('button', { name: 'Confirm transfer' }).click();
  await expect(form.getByRole('alert')).toContainText('not found');
  await form.getByLabel('Destination account ID').fill(source.toUpperCase());
  await form.getByRole('button', { name: 'Review transfer' }).click();
  await expect(form.getByLabel('Destination account ID')).toHaveAttribute('aria-invalid', 'true');
  await form.getByLabel('Destination account ID').fill(full);
  await form.getByLabel('Transfer amount').fill('2.01');
  await form.getByRole('button', { name: 'Review transfer' }).click();
  await form.getByRole('button', { name: 'Confirm transfer' }).click();
  await expect(form.getByRole('alert')).toContainText('insufficient balance');
  expect(await balance(request, source)).toBe('2.00');
  expect(await balance(request, full)).toBe('999999999999999999.99');
});

test('failed balance/history refresh preserves a completed receipt and read retries never repeat the transfer', async ({
  page,
  request,
}) => {
  const source = await account(request, '2.00'),
    destination = await account(request);
  let committed = false,
    balanceFailed = false,
    historyFailed = false,
    writes = 0;
  await page.route('**/api/v1/transfers', async (route) => {
    writes++;
    const response = await route.fetch();
    committed = true;
    await route.fulfill({ response });
  });
  await page.route(`**/accounts/${source}/balance`, async (route) => {
    if (committed && !balanceFailed) {
      balanceFailed = true;
      await route.fulfill({
        status: 500,
        json: { error: { code: 'INTERNAL_ERROR', message: 'Read failed', details: {} } },
      });
    } else await route.continue();
  });
  await page.route(`**/accounts/${source}/transactions?*`, async (route) => {
    if (committed && !historyFailed) {
      historyFailed = true;
      await route.fulfill({
        status: 500,
        json: { error: { code: 'INTERNAL_ERROR', message: 'Read failed', details: {} } },
      });
    } else await route.continue();
  });
  await page.goto(`/accounts/${source}`);
  const form = await review(page, destination);
  await form.getByRole('button', { name: 'Confirm transfer' }).click();
  await expect(form.getByText('Transfer complete', { exact: true })).toBeVisible();
  await expect(page.getByText('Last confirmed balance', { exact: true })).toBeVisible();
  await expect(page.getByTestId('account-balance')).toHaveText('2.00');
  await page.getByRole('button', { name: 'Retry balance' }).click();
  await expect(page.getByTestId('account-balance')).toHaveText('0.50');
  await page.getByRole('button', { name: 'Retry history' }).click();
  await expect(page.locator('.history-table')).toContainText('Shared expense');
  expect(writes).toBe(1);
  await expect(form.getByText('Transfer complete', { exact: true })).toBeVisible();
});
