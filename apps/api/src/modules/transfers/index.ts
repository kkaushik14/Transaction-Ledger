/** Public transfer feature entry; transaction-scoped persistence and HTTP controllers stay internal. */
export { createTransfersRouter } from './transfers.routes.js';
export { createTransfersService } from './transfers.service.js';
export type { TransfersService } from './transfers.service.js';
