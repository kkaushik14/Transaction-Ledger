/** Browser-test-only API fixture: isolated PostgreSQL, no .env, no hosted ledger writes. */
import { appendFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createErrorLogger } from '../../api/src/errors/index.js';
import { createServer } from 'node:http';
import { createApp } from '../../api/src/index.js';
import { createTestPostgres } from '../../api/tests/helpers/index.js';
const fixture = await createTestPostgres();
let cleanup: Promise<void> | undefined;
/** Teardown is explicit so the runner waits for disk cleanup before terminating the server group. */
function stopDatabase() {
  cleanup ??= fixture.stop();
  return cleanup;
}
// Fixture-only log output proves that a UI ticket resolves to an actual serialized API record.
const diagnosticDirectory = fileURLToPath(new URL('../test-results/', import.meta.url));
const diagnosticFile = fileURLToPath(new URL('../test-results/api-errors.jsonl', import.meta.url));
const logger = createErrorLogger((line) => {
  console.error(line);
  mkdirSync(diagnosticDirectory, { recursive: true });
  appendFileSync(diagnosticFile, `${line}\n`, { mode: 0o600 });
});
const app = createApp({ database: fixture.pool, webOrigin: 'http://127.0.0.1:5173', logger });
const server = createServer((request, response) => {
  if (request.method === 'POST' && request.url === '/__test/cleanup') {
    void stopDatabase().then(
      () => {
        response.writeHead(200);
        response.end('cleaned');
      },
      () => {
        response.writeHead(500);
        response.end('Test database cleanup failed');
      },
    );
    return;
  }
  if (request.url === '/__test/ready') {
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end('ready');
    return;
  }
  app(request, response);
});
await new Promise<void>((resolve, reject) => {
  server.once('error', reject);
  server.listen(4310, '127.0.0.1', resolve);
});
console.info('Isolated browser-test API ready on 127.0.0.1:4310');
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    if (stopping) return;
    stopping = true;
    void new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
      .finally(stopDatabase)
      .catch(() => {
        process.exitCode = 1;
      });
  });
}
