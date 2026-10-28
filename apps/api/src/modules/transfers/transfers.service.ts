/** Atomic transfers: ordered account locks, duplicate protection, exact balances and two immutable linked entries. */
import type { Pool } from 'pg';
import {
  createTransferResponseSchema,
  type CreateTransferRequest,
  type CreateTransferResponse,
} from '@ledger/contracts';
import { withTransaction } from '../../db/index.js';
import {
  AccountNotFoundError,
  DuplicateReferenceError,
  InsufficientBalanceError,
  BalanceLimitError,
} from '../../errors/index.js';
import { createTransfersRepository } from './transfers.repository.js';

/** The transfer feature exposes creation only; no update/delete or distributed-service behavior. */
export interface TransfersService {
  create(input: CreateTransferRequest): Promise<CreateTransferResponse['data']>;
}
/** Runs all five writes in one transaction; failures at any step roll back the complete movement. */
export function createTransfersService(pool: Pick<Pool, 'connect'>): TransfersService {
  return {
    async create(input) {
      return withTransaction(pool, async (client) => {
        const repository = createTransfersRepository(client);
        if (!(await repository.lockAccounts(input))) {
          throw new AccountNotFoundError();
        }
        // Check duplicates before funds so retries remain conflicts even after the
        // earlier transfer exhausted the source. Both account locks cover standalone writes too.
        if (await repository.hasTransfer(input)) {
          throw new DuplicateReferenceError('transfer');
        }
        if (await repository.hasLedgerReference(input)) {
          throw new DuplicateReferenceError('transaction');
        }
        const transfer = await repository.insertTransfer(input);
        const sourceBalance = await repository.updateBalance(
          input.source_account_id,
          input.amount,
          'debit',
        );
        if (sourceBalance === undefined) {
          throw new InsufficientBalanceError();
        }
        const destinationBalance = await repository.updateBalance(
          input.destination_account_id,
          input.amount,
          'credit',
        );
        if (destinationBalance === undefined) {
          throw new BalanceLimitError();
        }
        const debit = await repository.insertLeg(transfer, 'debit');
        const credit = await repository.insertLeg(transfer, 'credit');
        // Validate correlated DTOs before COMMIT: response serialization errors must
        // not hide a committed movement. withTransaction never automatically retries.
        return createTransferResponseSchema.parse({
          data: {
            transfer: { ...transfer, created_at: transfer.created_at.toISOString() },
            debit: { ...debit, created_at: debit.created_at.toISOString() },
            credit: { ...credit, created_at: credit.created_at.toISOString() },
            source_account_balance: sourceBalance,
            destination_account_balance: destinationBalance,
          },
        }).data;
      });
    },
  };
}
