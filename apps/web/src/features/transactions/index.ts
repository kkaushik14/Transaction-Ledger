/** Transaction feature facade, composed from owned hooks and components. Explicit exports define this folder's public boundary. */
export { TransactionForm, TransactionHistory } from './components/index.js';
export type { TransactionHistoryProps } from './components/index.js';
export { useTransactions } from './hooks/index.js';
export type { HistoryFilter } from './hooks/index.js';
