/** Public failures are actionable, correlated and free of diagnostic internals at real browser widths. */
import { test, expect } from '@playwright/test';
import { stat } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
const api = 'http://127.0.0.1:4310/api/v1';
const ticket = '11111111-1111-4111-8111-111111111111';

test('known HTTP failure uses only mapped copy, support ID, code and safe navigation at every width', async ({
  page,
  request,
}, info) => {
  const response = await request.get(`${api}/unavailable-route`);
  expect(response.status()).toBe(404);
  const failure = (await response.json()).error;
  expect(Object.keys(failure).sort()).toEqual(['action', 'code', 'message', 'support_ticket_id']);
  expect(response.headers()['x-support-ticket-id']).toBe(failure.support_ticket_id);
  const id = '64c7dc4e-509c-460b-9175-c79503c4f4c5';
  await page.route(`**/accounts/${id}/balance`, (route) =>
    route.fulfill({
      status: 404,
      json: {
        error: {
          support_ticket_id: ticket,
          code: 'ACCOUNT_NOT_FOUND',
          message: 'SELECT private_schema password=secret <script>unsafe</script>',
          action: 'retry',
        },
      },
    }),
  );
  await page.goto(`/accounts/${id}`);
  const alert = page.getByRole('alert');
  await expect(alert).toHaveCount(1);
  await expect(alert).toContainText(ticket);
  await expect(alert).toContainText('ACCOUNT_NOT_FOUND');
  await expect(alert).toContainText('Account not found');
  await expect(alert).not.toContainText('private_schema');
  await expect(alert).not.toContainText('secret');
  await expect(alert.getByRole('button')).toHaveCount(1);
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`error-${width}.png`), fullPage: true });
  }
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await alert.getByRole('button', { name: 'Go Back' }).click();
  await expect(page.getByLabel('Account ID', { exact: true })).toBeFocused();
});

test('an unconfirmed committed account creation cannot be retried blindly from the error view', async ({
  page,
}) => {
  let posts = 0;
  let createdId = '';
  await page.route('**/api/v1/accounts', async (route) => {
    posts++;
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    createdId = (await response.json()).data.id;
    await route.abort('failed');
  });
  await page.goto('/#get-started');
  await page.getByLabel('Account name').fill('Unconfirmed creation');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Retrying may create another account');
  await expect(alert).toContainText('Support ticket ID:');
  await expect(alert.getByRole('button', { name: 'Retry' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeDisabled();
  await alert.getByRole('button', { name: 'Go Back' }).click();
  await expect(page.getByLabel('Account ID', { exact: true })).toBeFocused();
  await page.getByLabel('Account ID', { exact: true }).fill(createdId);
  await page.getByRole('button', { name: 'Open account', exact: true }).click();
  await expect(page.getByTestId('account-balance')).toHaveText('0.00');
  expect(posts).toBe(1);
});

test('invalid input shows one mapped notice and its action returns focus without sending a request', async ({
  page,
}) => {
  let posts = 0;
  await page.route('**/api/v1/accounts', async (route) => {
    posts++;
    await route.abort();
  });
  await page.goto('/#get-started');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toHaveCount(1);
  await expect(alert).toContainText('INVALID_ACCOUNT_NAME');
  await expect(alert).toContainText('Support ticket ID:');
  await alert.getByRole('button', { name: 'Review details' }).click();
  await expect(page.getByLabel('Account name')).toBeFocused();
  await expect(page.getByLabel('Account name')).toHaveAttribute('aria-invalid', 'true');
  expect(posts).toBe(0);
});

test('a real displayed API ticket is traceable in browser console and serialized server logs', async ({
  page,
}) => {
  const { readFile } = await import('node:fs/promises');
  const logs: { supportTicketId: string; relatedSupportTicketIds?: string[] }[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().startsWith('{"supportTicketId":'))
      logs.push(JSON.parse(message.text()));
  });
  const id = '64c7dc4e-509c-460b-9175-c79503c4f4c5';
  const balanceResponse = page.waitForResponse((response) =>
    response.url().endsWith(`/accounts/${id}/balance`),
  );
  const historyResponse = page.waitForResponse((response) =>
    response.url().includes(`/accounts/${id}/transactions?`),
  );
  await page.goto(`/accounts/${id}`);
  const balance = await balanceResponse,
    history = await historyResponse;
  expect(balance.status()).toBe(404);
  expect(history.status()).toBe(404);
  const visibleId = (await balance.json()).error.support_ticket_id;
  const historyId = (await history.json()).error.support_ticket_id;
  await expect(page.getByRole('alert')).toContainText(visibleId);
  expect(balance.headers()['x-support-ticket-id']).toBe(visibleId);
  await expect
    .poll(() =>
      logs.some(
        (record) =>
          record.supportTicketId === visibleId &&
          record.relatedSupportTicketIds?.includes(historyId),
      ),
    )
    .toBe(true);
  const lines = (
    await readFile(new URL('../test-results/api-errors.jsonl', import.meta.url), 'utf8')
  )
    .trim()
    .split('\n');
  const records = lines.map(
    (line) =>
      JSON.parse(line) as {
        supportTicketId: string;
        timestamp: string;
        code: string;
        scope: string;
      },
  );
  const record = records.find((item) => item.supportTicketId === visibleId);
  expect(record?.code).toBe('ACCOUNT_NOT_FOUND');
  expect(record?.scope).toBe('GET /api/v1/accounts/:accountId/balance');
  expect(Number.isNaN(Date.parse(record!.timestamp))).toBe(false);
  expect(records.some((item) => item.supportTicketId === historyId)).toBe(true);
  expect(
    (await stat(new URL('../test-results/api-errors.jsonl', import.meta.url))).mode & 0o077,
  ).toBe(0);
  const download = await page.request.get('/test-results/api-errors.jsonl');
  expect(download.status()).toBe(403);
  expect(await download.text()).not.toContain(visibleId);
});

test('a restored unresolved write logs its newly displayed ticket and retry conflicts trace to the API log', async ({
  page,
  request,
}) => {
  const { readFile } = await import('node:fs/promises');
  const created = await request.post(`${api}/accounts`, {
    data: { name: 'Restored ticket audit' },
  });
  const id = (await created.json()).data.id;
  const logs: { supportTicketId: string; scope: string }[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().startsWith('{"supportTicketId":'))
      logs.push(JSON.parse(message.text()));
  });
  let writes = 0;
  await page.route(`**/accounts/${id}/transactions`, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    writes++;
    if (writes === 1) {
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      await route.abort('failed');
    } else await route.continue();
  });
  await page.goto(`/accounts/${id}`);
  await page.getByLabel('Amount', { exact: true }).fill('1.00');
  await page.getByRole('button', { name: 'Add credit', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Result not confirmed');
  logs.length = 0;
  await page.reload();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Result not confirmed');
  const restoredId = await alert
    .getByText(/Support ticket ID:/)
    .locator('code')
    .innerText();
  await expect
    .poll(() =>
      logs.some(
        (item) => item.supportTicketId === restoredId && item.scope === 'ui.error.transaction',
      ),
    )
    .toBe(true);
  expect(writes).toBe(1);
  const conflictResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/accounts/${id}/transactions`) &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Retry same request' }).click();
  const conflict = await conflictResponse;
  expect(conflict.status()).toBe(409);
  const conflictId = (await conflict.json()).error.support_ticket_id;
  await expect(page.getByRole('alert')).toContainText(conflictId);
  await expect.poll(() => logs.some((item) => item.supportTicketId === conflictId)).toBe(true);
  const log = await readFile(new URL('../test-results/api-errors.jsonl', import.meta.url), 'utf8');
  expect(
    log
      .split('\n')
      .some((line) => line.includes(conflictId) && line.includes('DUPLICATE_TRANSACTION')),
  ).toBe(true);
  expect(writes).toBe(2);
  await expect(page.getByTestId('account-balance')).toHaveText('1.00');
  const history = await request.get(`${api}/accounts/${id}/transactions`);
  expect((await history.json()).pagination.total_records).toBe(1);
});
