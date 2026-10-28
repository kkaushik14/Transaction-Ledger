/** Contract-validated browser HTTP adapters; no database dependencies. Explicit exports define this folder's public boundary. */
export { createTransfer } from './transfers.api.js';
export { ApiClientError, apiRequest, errorMessage } from './client.js';
export type { ClientErrorCode } from './client.js';
export { createAccount, getAccountBalance } from './accounts.api.js';
export { createTransaction, getTransactionHistory } from './transactions.api.js';
