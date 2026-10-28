/** Pool factories and transaction infrastructure; excludes the executable connection check. Explicit exports define this folder's public boundary. */
export { buildPoolConfig, createDatabasePool } from './pool.js';
export { withTransaction } from './transaction.js';
