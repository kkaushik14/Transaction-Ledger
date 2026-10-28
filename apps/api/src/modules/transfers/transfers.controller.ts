/** Transfer HTTP adapter; validated input reaches the atomic service and Express handles rejected promises. */
import type { RequestHandler } from 'express';
import type { CreateTransferRequest, CreateTransferResponse } from '@ledger/contracts';
import type { TransfersService } from './transfers.service.js';

/** Sends a creation response only once the service's complete transfer has committed. */
export function createTransfersController(
  service: TransfersService,
): RequestHandler<Record<string, never>, CreateTransferResponse, CreateTransferRequest> {
  return async (request, response) => {
    const result = await service.create(request.body);
    response.status(201).json({ data: result });
  };
}
