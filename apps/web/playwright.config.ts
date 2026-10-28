/** Real-browser QA uses only an isolated API/database and a dedicated Vite test environment. */
import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executable =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync(chrome) ? chrome : undefined);
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  globalTeardown: './e2e/teardown.ts',
  timeout: 45000,
  workers: 1,
  fullyParallel: false,
  outputDir: 'test-results',
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    browserName: 'chromium',
    trace: 'retain-on-failure',
    launchOptions: executable ? { executablePath: executable } : {},
    timezoneId: 'Asia/Kolkata',
  },
  webServer: [
    {
      command: 'pnpm --filter @ledger/api exec tsx ../web/e2e/server.ts',
      url: 'http://127.0.0.1:4310/__test/ready',
      timeout: 60000,
      reuseExistingServer: false,
    },
    {
      command: 'pnpm dev --host 127.0.0.1 --port 5173 --mode e2e',
      url: 'http://127.0.0.1:5173',
      timeout: 30000,
      reuseExistingServer: false,
      env: { VITE_API_BASE_URL: 'http://127.0.0.1:4310/api/v1' },
    },
  ],
});
