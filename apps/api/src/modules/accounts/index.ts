/** Account feature composition and use-case contracts; HTTP controllers and database rows stay internal. Explicit exports define this folder's public boundary. */
export { createAccountsRouter } from './accounts.routes.js';
export { createAccountsService } from './accounts.service.js';
export type { AccountsService } from './accounts.service.js';
export { createAccountsRepository } from './accounts.repository.js';
export type { AccountDatabase, AccountsRepository } from './accounts.repository.js';
