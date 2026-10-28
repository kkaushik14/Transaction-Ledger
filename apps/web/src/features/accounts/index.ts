/** Account feature facade, composed from owned hooks and components. Explicit exports define this folder's public boundary. */
export {
  AccountBalanceCard,
  AccountCreateForm,
  AccountLookupForm,
  AccountPageHeader,
  AccountWorkspace,
  ActiveAccountProvider,
  AccountAccessAction,
  ActiveAccountCard,
} from './components/index.js';
export { useAccount, useActiveAccount } from './hooks/index.js';
