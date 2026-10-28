/** v0.3 visual behavior uses the existing disposable fixture and leaves ledger semantics unchanged. */
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const headline = 'A clear view of every transaction.';

test('hero reveals once without moving CTAs, bundles dependencies locally and cleans up on navigation', async ({
  page,
}) => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (!['127.0.0.1', 'localhost'].includes(new URL(request.url()).hostname))
      external.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: headline })).toBeVisible();
  const cta = page.getByRole('link', { name: 'Create an account', exact: true }).first();
  const before = await cta.boundingBox();
  await expect(page.locator('[data-reveal-complete]')).toHaveAttribute(
    'data-reveal-complete',
    'true',
  );
  expect(await cta.boundingBox()).toEqual(before);
  await page
    .getByRole('button', { name: 'Open navigation' })
    .isVisible()
    .then(async (visible) => {
      if (visible) await page.setViewportSize({ width: 1440, height: 900 });
    });
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Features', exact: true })
    .click();
  await expect(page.locator('[data-reveal-complete]')).toHaveAttribute(
    'data-reveal-complete',
    'true',
  );
  await page.goto('/missing-route');
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(external).toEqual([]);
});

test('reduced motion is immediately static, with readable footer and no animated loaders', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('[data-hero-backdrop]')).toHaveAttribute(
    'data-hero-backdrop',
    'static',
  );
  await expect(page.locator('[data-reveal-complete]')).toHaveAttribute(
    'data-reveal-complete',
    'true',
  );
  await expect(page.locator('canvas')).toHaveCount(0);
  const gradients = await page
    .locator('body *')
    .evaluateAll((elements) =>
      elements
        .filter((element) => getComputedStyle(element).backgroundImage.includes('gradient('))
        .map((element) => element.tagName),
    );
  expect(gradients).toEqual(['FOOTER']);
  await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('unsupported WebGL keeps the static hero and account entry usable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined });
  });
  await page.goto('/');
  await expect(page.locator('[data-hero-backdrop]')).toHaveAttribute(
    'data-hero-backdrop',
    'static',
  );
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('link', { name: 'Create an account', exact: true }).first().click();
  await expect(page.getByLabel('Account name')).toBeFocused();
});

test('reference cubes respond only to desktop mouse hover and release resources on leave/resize/context loss', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8 });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const backdrop = page.locator('[data-hero-backdrop]');
  await expect(backdrop).toHaveAttribute('data-hero-cubes-enabled', 'true');
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.mouse.move(900, 140);
  await expect(backdrop).toHaveAttribute('data-hero-backdrop', 'animated');
  await expect(page.locator('canvas')).toBeAttached();
  const heroBox = await page.locator('section[aria-labelledby="hero-title"]').boundingBox();
  const canvasBox = await page.locator('canvas').boundingBox();
  expect(canvasBox).toEqual(heroBox);
  await expect(page.locator('[data-reveal-complete]')).toHaveAttribute(
    'data-reveal-complete',
    'true',
  );
  await page.mouse.move(300, 160);
  await page.mouse.move(730, 550, { steps: 35 });
  await page.screenshot({ path: info.outputPath('hero-desktop-hover.png') });
  await page.mouse.move(10, 10);
  await expect(page.locator('canvas')).toHaveCount(0);
  for (const width of [320, 375, 639, 640, 768, 1023]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.mouse.move(150, 150);
    await expect(backdrop).toHaveAttribute('data-hero-cubes-enabled', 'false');
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.setViewportSize({ width: 1024, height: 1000 });
  await page.mouse.move(900, 200);
  await expect(page.locator('canvas')).toBeAttached();
  await page
    .locator('canvas')
    .evaluate((canvas) =>
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })),
    );
  await expect(backdrop).toHaveAttribute('data-hero-backdrop', 'static');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('link', { name: 'Open an account', exact: true }).click();
  await expect(page.getByLabel('Account ID', { exact: true })).toBeFocused();
});

test('initial reads use skeletons; refresh retains the exact confirmed balance with a local spinner', async ({
  page,
  request,
}) => {
  const response = await request.post('http://127.0.0.1:4310/api/v1/accounts', {
    data: { name: 'Visual read QA' },
  });
  const { data } = await response.json();
  let releaseBalance: () => void = () => {};
  let releaseHistory: () => void = () => {};
  let balanceGate = new Promise<void>((resolve) => {
    releaseBalance = resolve;
  });
  let historyGate = new Promise<void>((resolve) => {
    releaseHistory = resolve;
  });
  await page.route('**/balance', async (route) => {
    await balanceGate;
    await route.continue();
  });
  await page.route('**/transactions?*', async (route) => {
    await historyGate;
    await route.continue();
  });
  await page.goto(`/accounts/${data.id}`);
  await expect(
    page.getByRole('status').filter({ hasText: 'Loading account balance…' }),
  ).toContainText('Loading account balance…');
  await expect(page.getByTestId('account-balance')).toHaveCount(0);
  releaseBalance();
  await expect(page.getByTestId('account-balance')).toHaveText('0.00');
  const history = page.getByRole('region', { name: 'Transaction history' });
  await expect(history.getByRole('status')).toContainText('Loading transaction history…');
  releaseHistory();
  await expect(page.getByText('No transactions yet', { exact: true })).toBeVisible();
  balanceGate = new Promise<void>((resolve) => {
    releaseBalance = resolve;
  });
  historyGate = new Promise<void>((resolve) => {
    releaseHistory = resolve;
  });
  await page.getByLabel('Amount', { exact: true }).fill('2.50');
  await page.getByRole('button', { name: 'Add credit', exact: true }).click();
  await expect(page.getByText('Updating from the ledger…')).toBeVisible();
  await expect(page.getByTestId('account-balance')).toHaveText('0.00');
  await expect(page.getByRole('region', { name: 'Account balance' })).toHaveAttribute(
    'aria-busy',
    'true',
  );
  releaseBalance();
  releaseHistory();
  await expect(page.getByTestId('account-balance')).toHaveText('2.50');
  await expect(page.getByRole('region', { name: 'Account balance' })).toHaveAttribute(
    'aria-busy',
    'false',
  );
});
