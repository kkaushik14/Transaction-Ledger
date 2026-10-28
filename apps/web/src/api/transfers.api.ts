/** Transfer HTTP adapter validates the response against both the shared schema and the preserved intent. */
import {
  createTransferRequestSchema,
  createTransferResponseSchema,
  type CreateTransferRequest,
} from '@ledger/contracts';
import { apiRequest, ApiClientError } from './client';
/** Sends exactly one immutable command; a mismatched receipt remains an uncertain outcome. */
export async function createTransfer(input: CreateTransferRequest) {
  const command = createTransferRequestSchema.parse(input);
  const response = await apiRequest('/transfers', createTransferResponseSchema, {
    method: 'POST',
    body: command,
  });
  const transfer = response.data.transfer;
  if (
    transfer.source_account_id !== command.source_account_id ||
    transfer.destination_account_id !== command.destination_account_id ||
    transfer.amount !== command.amount ||
    transfer.reference_id !== command.reference_id ||
    transfer.description !== command.description
  ) {
    throw new ApiClientError(
      'The transfer response did not match your request. Review the account before retrying.',
      'INVALID_RESPONSE',
    );
  }
  return response;
}
