/** Transfer lifecycle entry; persistence helpers remain below the public feature facade. */
export { useTransferIntent } from './useTransferIntent.js';
export type { TransferPhase } from './useTransferIntent.js';
export { readTransferIntent, saveTransferIntent, clearTransferIntent } from './transfer-intent.js';
