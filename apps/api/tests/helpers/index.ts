/** Shared disposable database fixture; importing never starts a cluster. Explicit exports define this folder's public boundary. */
export { createTestPostgres } from './test-postgres.js';
