/** Awaits disposable database cleanup before Playwright stops its web-server process group. */
export default async function teardown(): Promise<void> {
  const response = await fetch('http://127.0.0.1:4310/__test/cleanup', {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Browser-test database cleanup failed');
}
