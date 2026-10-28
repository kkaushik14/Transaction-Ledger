/** API feature composition; infrastructure remains outside domain folders. Explicit exports define this folder's public boundary. */
export { createTransfersRouter, createTransfersService } from './transfers/index.js';
export type { TransfersService } from './transfers/index.js';
export {
  createAccountsRouter,
  createAccountsService,
  createAccountsRepository,
} from './accounts/index.js';
export type { AccountsService, AccountDatabase, AccountsRepository } from './accounts/index.js';
export { createTransactionsRouter, createTransactionsService } from './transactions/index.js';
export type { TransactionsService } from './transactions/index.js';
