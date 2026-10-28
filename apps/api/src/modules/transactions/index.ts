/** Credit/debit and history feature API; SQL and HTTP adapters stay internal. Explicit exports define this folder's public boundary. */
export { createTransactionsRouter } from './transactions.routes.js';
export { createTransactionsService } from './transactions.service.js';
export type { TransactionsService } from './transactions.service.js';
