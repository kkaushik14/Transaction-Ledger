/** End-to-end UI, responsive navigation, accessibility, and safe write retries on a disposable database. */
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const api = 'http://127.0.0.1:4310/api/v1';
let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(() => expect(errors).toEqual([]));
/** Creates a test account only in the local browser-fixture database. */
async function createAccount(request: APIRequestContext, name = 'Browser QA'): Promise<string> {
  const response = await request.post(`${api}/accounts`, { data: { name } });
  expect(response.status()).toBe(201);
  const body = await response.json();
  return body.data.id;
}
/** Asserts content fits without relying on overflow-x:hidden to hide layout defects. */
async function noOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    width: innerWidth,
  }));
  expect(metrics.document).toBeLessThanOrEqual(metrics.width);
  expect(metrics.body).toBeLessThanOrEqual(metrics.width);
}

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`landing layout and navigation at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('transaction.');
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeAttached();
    if (width >= 1024) {
      await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Open navigation' })).toBeHidden();
    } else {
      await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
      await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
    }
    await noOverflow(page);
    const colors = await page
      .locator('body,button,input,h1')
      .evaluateAll((elements) => elements.map((element) => getComputedStyle(element).color));
    for (const color of colors) {
      const channels = color.match(/\d+/g)?.slice(0, 3);
      expect(new Set(channels).size).toBe(1);
    }
    await page.screenshot({ path: info.outputPath(`landing-${width}.png`), fullPage: true });
  });
}

test('drawer supports focus containment, Escape, backdrop, navigation, and desktop reset', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Open navigation' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Explore the ledger' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close navigation' })).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  await trigger.click();
  await page.mouse.click(5, 150);
  await expect(dialog).toBeHidden();
  await trigger.click();
  await dialog.getByRole('link', { name: 'Features', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#features')).toBeFocused();
  await trigger.click();
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('link', { name: 'Transaction Ledger home' })).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('hero CTAs focus the real form fields and skip link remains keyboard reachable', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toHaveCSS('opacity', '0');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Skip to content' })).toHaveCSS('opacity', '1');
  const hero = page.locator('section[aria-labelledby="hero-title"]');
  await hero.getByRole('link', { name: 'Create an account' }).click();
  await expect(page.getByLabel('Account name')).toBeFocused();
  await page.goto('/');
  await hero.getByRole('link', { name: 'Open an account' }).click();
  await expect(page.getByLabel('Account ID', { exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Open account', exact: true }).click();
  await expect(page.getByText('Enter a valid Account ID.')).toBeVisible();
});

test('creates an account, credits/debits, filters history, rejects overspending, and copies UUID', async ({
  page,
  context,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#get-started');
  await page.getByLabel('Account name').fill('QA account');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/accounts\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { level: 1, name: 'QA account' })).toBeVisible();
  await expect(page.getByTestId('account-balance')).toHaveText('0.00');
  await page.getByLabel('Amount', { exact: true }).fill('100.25');
  await page.getByLabel('Description (optional)', { exact: true }).fill('Opening entry');
  await page.getByRole('button', { name: 'Add credit', exact: true }).click();
  await expect(page.getByText('Credit recorded', { exact: true })).toBeVisible();
  await expect(page.getByTestId('account-balance')).toHaveText('100.25');
  await page.getByRole('button', { name: 'New transaction', exact: true }).click();
  await page.getByLabel('Transaction type').selectOption('debit');
  await page.getByLabel('Amount', { exact: true }).fill('25.25');
  await page.getByLabel('Description (optional)', { exact: true }).fill('Recorded expense');
  await page.getByRole('button', { name: 'Add debit', exact: true }).click();
  await expect(page.getByText('Debit recorded', { exact: true })).toBeVisible();
  await expect(page.getByTestId('account-balance')).toHaveText('75.00');
  await page.getByLabel('Filter by type').selectOption('debit');
  await expect(page.locator('.history-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.history-table')).toContainText('Recorded expense');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy account ID' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Account ID copied.' })).toBeVisible();
  const id = new URL(page.url()).pathname.split('/').pop();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(id);
  await page.screenshot({ path: info.outputPath('account-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'New transaction', exact: true }).click();
  await page.getByLabel('Amount', { exact: true }).fill('500');
  await page.getByRole('button', { name: 'Add debit', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('insufficient balance');
  await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('500');
  await expect(page.getByTestId('account-balance')).toHaveText('75.00');
  await page.setViewportSize({ width: 375, height: 900 });
  await noOverflow(page);
  await expect(page.locator('.history-table')).toBeHidden();
  await expect(page.locator('.history-cards')).toBeVisible();
  await page.screenshot({ path: info.outputPath('account-mobile.png'), fullPage: true });
});

test('maximum balances and long account/history content fit at every required width', async ({
  page,
  request,
}, info) => {
  const name = 'A'.repeat(120);
  const id = await createAccount(request, name);
  const amount = '999999999999999999.99';
  const response = await request.post(`${api}/accounts/${id}/transactions`, {
    data: { type: 'credit', amount, reference_id: 'R'.repeat(128), description: 'D'.repeat(500) },
  });
  expect(response.status()).toBe(201);
  await page.goto('/#get-started');
  // Creation carries known metadata; use the actual create form for the long-name header too.
  await page.getByLabel('Account name').fill(name);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await page.getByRole('link', { name: 'Transaction Ledger home' }).click();
  await expect(page.getByText('Your account is ready', { exact: true })).toBeVisible();
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(page);
  }
  await page.goto(`/accounts/${id}`);
  await expect(page.getByTestId('account-balance')).toHaveText(amount);
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(page);
    const balance = page.getByTestId('account-balance');
    expect(await balance.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    const lineCounts = await page.locator('[data-long="true"]').evaluateAll((elements) =>
      elements
        .filter((element) => element.checkVisibility())
        .map((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top))).size;
        }),
    );
    expect(lineCounts.every((count) => count === 1)).toBe(true);
    if (width === 320) {
      await page.screenshot({ path: info.outputPath('account-long-320.png'), fullPage: true });
    }
  }
});

test('lookup uses the Account/UUID fallback and history filter resets pagination', async ({
  page,
  request,
}, info) => {
  const id = await createAccount(request);
  await Promise.all(
    Array.from({ length: 25 }, (_, i) =>
      request
        .post(`${api}/accounts/${id}/transactions`, {
          data: {
            type: 'credit',
            amount: '0.01',
            reference_id: `browser-${i}`,
            description: `Entry ${i}`,
          },
        })
        .then((response) => expect(response.status()).toBe(201)),
    ),
  );
  await page.goto('/#get-started');
  await page.getByLabel('Account ID', { exact: true }).fill(id);
  await page.getByRole('button', { name: 'Open account', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Account', exact: true })).toBeVisible();
  await expect(page.getByTestId('account-balance')).toHaveText('0.25');
  await expect(page.getByText('25 transactions · Page 1 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('25 transactions · Page 2 of 2')).toBeVisible();
  await expect(page.locator('.history-table tbody tr')).toHaveCount(5);
  await page.getByLabel('Filter by type').selectOption('debit');
  await expect(page.getByText('No matching transactions')).toBeVisible();
  await page.getByLabel('Filter by type').selectOption('credit');
  await expect(page.getByText('25 transactions · Page 1 of 2')).toBeVisible();
  await page.screenshot({ path: info.outputPath('history-pagination.png'), fullPage: true });
});

test('lost committed response retries the identical reference and moves money only once', async ({
  page,
  request,
}) => {
  const id = await createAccount(request);
  let first = true;
  const bodies: unknown[] = [];
  await page.route(`**/accounts/${id}/transactions`, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    bodies.push(route.request().postDataJSON());
    if (first) {
      first = false;
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      await route.abort('failed');
    } else await route.continue();
  });
  await page.goto(`/accounts/${id}`);
  await page.getByLabel('Amount', { exact: true }).fill('1.50');
  await page.getByRole('button', { name: 'Add credit', exact: true }).click();
  await expect(page.getByText('Result not confirmed', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Amount', { exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Retry same request' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry same request' }).click();
  await expect(page.getByText('Reference already used', { exact: true })).toBeVisible();
  await expect(page.getByTestId('account-balance')).toHaveText('1.50');
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual(bodies[1]);
  const history = await request.get(`${api}/accounts/${id}/transactions`);
  expect((await history.json()).pagination.total_records).toBe(1);
});

test('recovers from missing accounts and invalid routes without inventing data', async ({
  page,
}) => {
  await page.goto('/accounts/not-a-uuid');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This account ID is not valid.');
  await page.goto('/accounts/64c7dc4e-509c-460b-9175-c79503c4f4c5');
  await expect(page.getByRole('alert')).toContainText('Account not found');
  await expect(page.getByTestId('account-balance')).toHaveCount(0);
  await page.goto('/missing');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'We couldn’t find that page.',
  );
  await page.getByRole('link', { name: 'Back to overview' }).click();
  await expect(page).toHaveURL('/');
});

test('landing, account, and modal pass automated accessibility checks', async ({
  page,
  request,
}) => {
  const id = await createAccount(request);
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ['/', `/accounts/${id}`]) {
      await page.goto(path);
      if (path !== '/') await expect(page.getByTestId('account-balance')).toBeVisible();
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(result.violations).toEqual([]);
    }
  }
  await page.setViewportSize({ width: 375, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(result.violations).toEqual([]);
});

test('account creation selection survives navigation/reload; logout and ID lookup retain the ledger and duplicate names stay allowed', async ({
  page,
  request,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#get-started');
  await page.getByLabel('Account name').fill('Same name is allowed');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByTestId('account-balance')).toHaveText('0.00');
  const first = new URL(page.url()).pathname.split('/').pop()!;
  await expect(page.getByRole('banner').getByRole('button', { name: 'Log out' })).toBeVisible();
  await expect(
    page.getByRole('banner').getByRole('link', { name: 'Create an account' }),
  ).toHaveCount(0);
  await page.getByLabel('Amount', { exact: true }).fill('12.50');
  await page.getByRole('button', { name: 'Add credit', exact: true }).click();
  await expect(page.getByTestId('account-balance')).toHaveText('12.50');
  await page.getByRole('link', { name: 'Transaction Ledger home' }).click();
  await expect(page.getByLabel('Account name')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Your account is ready', { exact: true })).toBeVisible();
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(page);
    if (width < 1024) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('button', { name: 'Log out' })).toBeVisible();
      await expect(dialog.getByRole('link', { name: 'Create an account' })).toHaveCount(0);
      await expect(dialog.getByRole('link', { name: 'My account' })).toHaveAttribute(
        'href',
        `/accounts/${first}`,
      );
      await page.keyboard.press('Escape');
    } else
      await expect(page.getByRole('banner').getByRole('button', { name: 'Log out' })).toBeVisible();
    await page.locator('#get-started').scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`selected-account-${width}.png`) });
  }
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByText('Logged out', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Account name')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Account name')).toBeVisible();
  await page.getByLabel('Account ID', { exact: true }).fill(first.toUpperCase());
  await page.getByRole('button', { name: 'Open account', exact: true }).click();
  await expect(page.getByTestId('account-balance')).toHaveText('12.50');
  await expect(page.getByText('1 transaction · Page 1 of 1')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('banner').getByRole('button', { name: 'Log out' }).click();
  await page.getByLabel('Account name').fill('Same name is allowed');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByTestId('account-balance')).toHaveText('0.00');
  const second = new URL(page.url()).pathname.split('/').pop()!;
  expect(second).not.toBe(first);
  expect((await (await request.get(`${api}/accounts/${first}/balance`)).json()).data.balance).toBe(
    '12.50',
  );
});

test('a concurrent balance change is refreshed after rejected debit, and a definitive missing-account read removes stale write controls', async ({
  page,
  request,
}) => {
  const id = await createAccount(request);
  await page.goto(`/accounts/${id}`);
  await expect(page.getByTestId('account-balance')).toHaveText('0.00');
  expect(
    (
      await request.post(`${api}/accounts/${id}/transactions`, {
        data: { type: 'credit', amount: '5.00', reference_id: 'external-credit' },
      })
    ).status(),
  ).toBe(201);
  await page.getByLabel('Transaction type').selectOption('debit');
  await page.getByLabel('Amount', { exact: true }).fill('6');
  await page.getByRole('button', { name: 'Add debit', exact: true }).click();
  await expect(page.getByTestId('account-balance')).toHaveText('5.00');
  await expect(page.getByText('1 transaction · Page 1 of 1')).toBeVisible();
  await page.route(`**/accounts/${id}/balance`, (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found', details: {} },
      }),
    }),
  );
  await page.getByRole('button', { name: 'Add debit', exact: true }).click();
  await expect(page.getByTestId('account-balance')).toHaveCount(0);
  await expect(page.getByRole('form', { name: 'New transaction' })).toHaveCount(0);
  await expect(page.getByRole('form', { name: 'Transfer between accounts' })).toHaveCount(0);
});
