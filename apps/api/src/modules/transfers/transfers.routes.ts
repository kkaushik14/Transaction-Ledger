/** Registers transfer creation with JSON and strict validation before acquiring database resources. */
import { Router } from 'express';
import { createTransferRequestSchema } from '@ledger/contracts';
import { requireJson, validate } from '../../middleware/index.js';
import { createTransfersController } from './transfers.controller.js';
import type { TransfersService } from './transfers.service.js';

/** Routes relative to /api/v1/transfers; no transfer editing, deletion or UI endpoints exist. */
export function createTransfersRouter(service: TransfersService): Router {
  const router = Router();
  // POST validates shape, distinct UUIDs and exact positive amounts before any locks or writes.
  router.post(
    '/',
    requireJson,
    validate(createTransferRequestSchema, 'body'),
    createTransfersController(service),
  );
  return router;
}
