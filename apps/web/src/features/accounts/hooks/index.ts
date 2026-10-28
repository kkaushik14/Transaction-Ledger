/** Account read orchestration; no requests run on import. Explicit exports define this folder's public boundary. */
export { useAccount } from './useAccount.js';
export { ActiveAccountContext, useActiveAccount } from './active-account.js';
export type { ActiveAccount, ActiveAccountState } from './active-account.js';
