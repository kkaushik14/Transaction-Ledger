/** Account creation/read policy and DTO normalization, independent of Express. */
import {
  accountSchema,
  accountBalanceResponseSchema,
  type Account,
  type AccountBalanceResponse,
  type CreateAccountRequest,
} from '@ledger/contracts';
import { AccountNotFoundError } from '../../errors/index.js';
import type { AccountsRepository } from './accounts.repository.js';

/** Implemented account use cases; no credit/debit operations are exposed. */
export interface AccountsService {
  create(input: CreateAccountRequest): Promise<Account>;
  getBalance(accountId: string): Promise<AccountBalanceResponse['data']>;
}

/** Creates account use cases with a repository dependency for isolated verification. */
export function createAccountsService(repository: AccountsRepository): AccountsService {
  return {
    async create(input) {
      const row = await repository.insert(input.name);
      // Keep numeric strings intact; only the database timestamp needs ISO conversion.
      return accountSchema.parse({ ...row, created_at: row.created_at.toISOString() });
    },
    async getBalance(accountId) {
      const row = await repository.findBalance(accountId);
      if (!row) throw new AccountNotFoundError();
      return accountBalanceResponseSchema.parse({ data: row }).data;
    },
  };
}
