/** Synthetic versioned documentation examples contain no configured account IDs, credentials or live data. */
import {
  resolveErrorMessage,
  type ApiErrorCode,
  type ApiErrorResponse,
  type CreateAccountResponse,
  type CreateTransactionRequest,
  type CreateTransactionResponse,
  type CreateTransferRequest,
  type CreateTransferResponse,
  type TransactionHistoryResponse,
} from '@ledger/contracts';
const accountId = '64c7dc4e-509c-460b-9175-c79503c4f4c5';
const destinationId = 'bbbbbbbb-0000-4000-8000-000000000002';
export const accountCreated = {
  data: {
    id: accountId,
    name: 'Alex Morgan',
    balance: '0.00',
    created_at: '2026-10-28T00:00:00.000Z',
  },
} satisfies CreateAccountResponse;
export const creditRequest = {
  type: 'credit',
  amount: '50.00',
  reference_id: 'ref-001',
  description: 'Opening credit',
} satisfies CreateTransactionRequest;
export const debitRequest = {
  type: 'debit',
  amount: '20.00',
  reference_id: 'ref-002',
  description: 'Recorded debit',
} satisfies CreateTransactionRequest;
export const creditCreated = {
  data: {
    transaction: {
      id: '256db272-a509-4e47-b8de-85e52d23829b',
      account_id: accountId,
      ...creditRequest,
      created_at: '2026-10-28T00:01:00.000Z',
    },
    account_balance: '50.00',
  },
} satisfies CreateTransactionResponse;
export const debitCreated = {
  data: {
    transaction: {
      id: 'dddddddd-0000-4000-8000-000000000004',
      account_id: accountId,
      ...debitRequest,
      created_at: '2026-10-28T00:02:00.000Z',
    },
    account_balance: '30.00',
  },
} satisfies CreateTransactionResponse;
export const history = {
  data: [debitCreated.data.transaction, creditCreated.data.transaction],
  pagination: { page: 1, limit: 20, total_records: 2, total_pages: 1 },
} satisfies TransactionHistoryResponse;
export const transferRequest = {
  source_account_id: accountId,
  destination_account_id: destinationId,
  amount: '25.50',
  reference_id: 'transfer-001',
  description: 'Shared expense',
} satisfies CreateTransferRequest;
const transfer = {
  id: 'cccccccc-0000-4000-8000-000000000003',
  ...transferRequest,
  created_at: '2026-10-28T00:03:00.000Z',
};
const leg = {
  amount: transfer.amount,
  reference_id: transfer.reference_id,
  description: transfer.description,
  transfer_id: transfer.id,
  created_at: transfer.created_at,
};
export const transferCreated = {
  data: {
    transfer,
    debit: {
      ...leg,
      id: 'eeeeeeee-0000-4000-8000-000000000005',
      account_id: accountId,
      type: 'debit',
    },
    credit: {
      ...leg,
      id: 'ffffffff-0000-4000-8000-000000000006',
      account_id: destinationId,
      type: 'credit',
    },
    source_account_balance: '74.50',
    destination_account_balance: '25.50',
  },
} satisfies CreateTransferResponse;
/** Public failure copy/action examples share the actual application resolver and four-field envelope. */
export function errorExample(code: ApiErrorCode): ApiErrorResponse {
  return {
    error: {
      support_ticket_id: '11111111-1111-4111-8111-111111111111',
      code,
      ...resolveErrorMessage(code),
    },
  };
}
