/** Swagger UI renders real local assets/spec and executes requests only after explicit user action. */
import { test, expect } from '@playwright/test';
const origin = 'http://127.0.0.1:4310';

test('versioned Swagger documentation renders all operations without CDN or automatic ledger requests', async ({
  page,
}) => {
  const external: string[] = [],
    businessRequests: string[] = [],
    failures: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.hostname !== '127.0.0.1') external.push(request.url());
    if (url.pathname.startsWith('/api/v1')) businessRequests.push(request.url());
  });
  page.on('pageerror', (error) => failures.push(error.message));
  await page.goto(`${origin}/api/docs`);
  await expect(page).toHaveURL(`${origin}/api/docs/`);
  await expect(page).toHaveTitle('Transaction Ledger API v1');
  await expect(page.locator('.swagger-ui .info .title')).toContainText('Transaction Ledger API');
  await expect(page.locator('.opblock')).toHaveCount(5);
  await expect(page.locator('#operations-Transfers-createTransfer')).toContainText('/transfers');
  await page.locator('#operations-Transactions-getTransactionHistory .opblock-summary').click();
  const history = page.locator('#operations-Transactions-getTransactionHistory');
  await expect(history.locator('tbody .parameters-col_name')).toContainText([
    'accountId',
    'type',
    'page',
    'limit',
  ]);
  expect(external).toEqual([]);
  expect(businessRequests).toEqual([]);
  expect(failures).toEqual([]);
});

test('Swagger Try it out reaches the current API origin and shows its real documented response', async ({
  page,
  request,
}) => {
  // Explicit writes are confined to this disposable fixture; opening docs alone is read-only.
  await page.goto(`${origin}/api/docs/`);
  const operation = page.locator('#operations-Accounts-createAccount');
  await operation.locator('.opblock-summary').click();
  await operation.getByRole('button', { name: 'Try it out' }).click();
  await operation
    .locator('textarea')
    .fill(JSON.stringify({ name: 'Isolated Swagger documentation QA' }));
  const completed = page.waitForResponse(
    (response) =>
      response.url() === `${origin}/api/v1/accounts` && response.request().method() === 'POST',
  );
  await operation.getByRole('button', { name: 'Execute', exact: true }).click();
  const response = await completed;
  expect(response.status()).toBe(201);
  const { data } = await response.json();
  await expect(operation.locator('.responses-inner')).toContainText(data.id);
  expect(data.balance).toBe('0.00');
  const balance = await request.get(`${origin}/api/v1/accounts/${data.id}/balance`);
  expect(balance.status()).toBe(200);
  expect((await balance.json()).data).toEqual({ account_id: data.id, balance: '0.00' });
});
