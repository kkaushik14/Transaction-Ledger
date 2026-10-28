/** Primary API documentation for the implemented v1 wire contract; no environment or database access. */
import type * as OpenAPI from 'openapi3-ts/oas31';
import type { ApiErrorCode } from '@ledger/contracts';
import { schemas } from './schemas.js';
import {
  accountCreated,
  creditRequest,
  debitRequest,
  creditCreated,
  debitCreated,
  history,
  transferRequest,
  transferCreated,
  errorExample,
} from './examples.js';

/** Internal component references stay local so specs never fetch remote schemas. */
function schema(name: keyof typeof schemas): OpenAPI.ReferenceObject {
  return { $ref: `#/components/schemas/${name}` };
}
/** Shared JSON responses keep examples and response schema references next to their status descriptions. */
function success(
  description: string,
  name: keyof typeof schemas,
  examples: Record<string, OpenAPI.ExampleObject>,
): OpenAPI.ResponseObject {
  return { description, content: { 'application/json': { schema: schema(name), examples } } };
}
/** Every documented error includes the same safe envelope and support-ID response header. */
function error(description: string, codes: ApiErrorCode[]): OpenAPI.ResponseObject {
  return {
    description,
    headers: {
      'X-Support-Ticket-ID': {
        description:
          'Same server-generated UUID as error.support_ticket_id; correlates private diagnostics, not an external ticket.',
        schema: { type: 'string', format: 'uuid' },
        example: '11111111-1111-4111-8111-111111111111',
      },
    },
    content: {
      'application/json': {
        schema: schema('ApiErrorResponse'),
        examples: Object.fromEntries(codes.map((code) => [code, { value: errorExample(code) }])),
      },
    },
  };
}
const errors = {
  RouteNotFound: error(
    'Unsupported route or method, including ledger/transfer mutation endpoints.',
    ['ROUTE_NOT_FOUND'],
  ),
  Validation: error(
    'Malformed UUID, body/query/JSON, unknown fields, invalid amount, or self-transfer. No financial mutation.',
    ['VALIDATION_ERROR'],
  ),
  MissingAccount: error('One or more requested accounts do not exist. No financial mutation.', [
    'ACCOUNT_NOT_FOUND',
  ]),
  DuplicateTransaction: error(
    'The account already contains this exact reference. No new movement and no replay of the original success response.',
    ['DUPLICATE_TRANSACTION'],
  ),
  DuplicateTransfer: error(
    'Source/reference already identifies a transfer, or either participating ledger already uses the reference. No new movement. The earlier payload/result is not confirmed by this conflict.',
    ['DUPLICATE_TRANSFER', 'DUPLICATE_TRANSACTION'],
  ),
  BalanceGuard: error(
    'Insufficient debit/source balance or credit/destination capacity above 999999999999999999.99. All attempted writes roll back.',
    ['INSUFFICIENT_BALANCE', 'BALANCE_LIMIT_EXCEEDED'],
  ),
  TooLarge: error('JSON body exceeds the 16 KiB parser limit; rejected before financial work.', [
    'PAYLOAD_TOO_LARGE',
  ]),
  UnsupportedMedia: error(
    'Mutation Content-Type must be application/json; unsupported encoding/charset is rejected.',
    ['UNSUPPORTED_MEDIA_TYPE'],
  ),
  Internal: error(
    'Unexpected failure. A write may already have committed if its acknowledgement was lost: this is not proof of rollback. Financial retries must preserve the original reference and complete payload. Account creation has no idempotency key; do not retry blindly.',
    ['INTERNAL_ERROR'],
  ),
};
/** Status-to-component mapping is descriptive only; the HTTP middleware remains the status owner. */
function failures(mapping: Record<string, keyof typeof errors>): OpenAPI.ResponsesObject {
  return Object.fromEntries(
    Object.entries(mapping).map(([status, name]) => [
      status,
      { $ref: `#/components/responses/${name}` },
    ]),
  );
}
const mutationErrors = {
  '400': 'Validation',
  '413': 'TooLarge',
  '415': 'UnsupportedMedia',
  '500': 'Internal',
} as const;
const accountParameter: OpenAPI.ParameterObject = {
  name: 'accountId',
  in: 'path',
  required: true,
  description: 'Existing account UUID (Account ID). Possession of an ID is not authentication.',
  schema: schema('AccountId'),
  example: accountCreated.data.id,
};

/** Versioned, serializable OpenAPI 3.1 source consumed by Swagger UI and downloadable clients. */
export const openApiV1: OpenAPI.OpenAPIObject = {
  openapi: '3.1.0',
  info: {
    title: 'Transaction Ledger API',
    version: '1.0.0',
    description: `Primary documentation for the implemented account, balance, credit/debit, history and bonus transfer APIs.

JSON uses snake_case; money is an exact decimal string, never a JSON number. Bodies reject unknown properties. Account names may repeat; UUIDs identify accounts. This demo has no authentication; Account IDs and CORS do not authorize users.

Financial writes are atomic and never retry automatically. Reuse the entire original payload and reference_id after an uncertain response. Duplicate references return 409, not a replayed 201. A timeout/500 may follow a durable commit; do not report definite rollback or generate a fresh retry reference. Account creation is not idempotent.

All error envelopes contain only support_ticket_id, code, mapped message and action. The same support ID is returned in X-Support-Ticket-ID. Action identifiers map to client controls; they are not scripts or URLs. Unknown routes/methods (including account/transaction/transfer updates and deletes) return 404 ROUTE_NOT_FOUND with this envelope. No account listing or transfer listing/retrieval endpoints exist.

Examples are synthetic and do not refer to demonstration or production accounts. Opening documentation never calls the database; Try it out sends requests only after explicit user execution.`,
  },
  servers: [
    {
      url: '/api/v1',
      description:
        'Current API origin; version 1. No hard-coded deployment host or database credentials.',
    },
  ],
  security: [],
  tags: [
    { name: 'Accounts', description: 'Create an account and retrieve its exact current balance.' },
    {
      name: 'Transactions',
      description: 'Immutable credit/debit entries and filtered latest-first history.',
    },
    {
      name: 'Transfers',
      description:
        'Bonus API: atomic account-to-account transfers with two correlated ledger legs.',
    },
  ],
  paths: {
    '/accounts': {
      post: {
        tags: ['Accounts'],
        operationId: 'createAccount',
        summary: 'Create an account with zero balance',
        description:
          'Accepts only name; trims it before validating 1–120 Unicode code points. Duplicate names are allowed. The database generates the UUID/time and zero balance. Every successful request creates a new account; there is no reference_id or safe blind retry after response loss.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: schema('CreateAccountRequest'),
              examples: { account: { value: { name: 'Alex Morgan' } } },
            },
          },
        },
        responses: {
          '201': success('Account created with zero balance.', 'CreateAccountResponse', {
            created: { value: accountCreated },
          }),
          ...failures(mutationErrors),
        },
      },
    },
    '/accounts/{accountId}/balance': {
      get: {
        tags: ['Accounts'],
        operationId: 'getAccountBalance',
        summary: 'Retrieve the current account balance',
        description:
          'Returns the exact nonnegative two-decimal balance and account_id, without an account name. Does not mutate or calculate money in JavaScript.',
        parameters: [accountParameter],
        responses: {
          '200': success('Current server balance.', 'AccountBalanceResponse', {
            balance: { value: { data: { account_id: accountCreated.data.id, balance: '50.00' } } },
          }),
          ...failures({ '400': 'Validation', '404': 'MissingAccount', '500': 'Internal' }),
        },
      },
    },
    '/accounts/{accountId}/transactions': {
      post: {
        tags: ['Transactions'],
        operationId: 'createTransaction',
        summary: 'Credit or debit an account',
        description:
          'A positive exact amount and reference_id are required; description defaults to an empty string. On one transaction/client, lock the account, check reference, guard/update balance and insert a ledger row, then commit. (account_id, reference_id) is unique, case-sensitive and preserved exactly, including whitespace. A repeated reference returns 409 even with changed type/amount/description or an exhausted balance; other accounts may reuse it. Any known rejection rolls back all attempted writes. After a timeout/unconfirmed result, retry only the same payload/reference and reconcile balance/history; a duplicate is not a confirmed replay.',
        parameters: [accountParameter],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: schema('CreateTransactionRequest'),
              examples: {
                credit: { summary: 'Add funds', value: creditRequest },
                debit: { summary: 'Spend existing funds', value: debitRequest },
              },
            },
          },
        },
        responses: {
          '201': success(
            'Balance and immutable entry committed together.',
            'CreateTransactionResponse',
            { credit: { value: creditCreated }, debit: { value: debitCreated } },
          ),
          ...failures({
            ...mutationErrors,
            '404': 'MissingAccount',
            '409': 'DuplicateTransaction',
            '422': 'BalanceGuard',
          }),
        },
      },
      get: {
        tags: ['Transactions'],
        operationId: 'getTransactionHistory',
        summary: 'Retrieve filtered, paginated transaction history',
        description:
          'Rows belong to this account; optional type filtering happens before totals and pagination. Order is created_at DESC, id DESC (deterministic UUID tie-breaker). Includes standalone and transfer legs; history DTOs deliberately omit transfer_id. A known account with no matching rows has empty data and zero totals/pages. Beyond-last pages return empty data with the requested page and correct totals. Each response uses a read-only REPEATABLE READ snapshot for existence, totals and rows. Separate page requests have separate snapshots, so new writes can shift offset pages. Query integers must use canonical positive decimal digits: no signs, leading zeros, spaces, decimals or exponents. Repeated/array/nested/unknown parameters are rejected. Both integers and (page-1)*limit must be safe JavaScript integers (maximum 9007199254740991).',
        parameters: [
          accountParameter,
          {
            name: 'type',
            in: 'query',
            required: false,
            description: 'Omit to include both types. Filter totals as well as rows.',
            schema: { type: 'string', enum: ['credit', 'debit'] },
            example: 'credit',
          },
          {
            name: 'page',
            in: 'query',
            required: false,
            description: '1-based canonical integer. The derived offset must also remain safe.',
            schema: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER, default: 1 },
            example: 1,
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            description: 'Maximum matching entries per page, 1–100.',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            example: 20,
          },
        ],
        responses: {
          '200': success(
            'Latest-first rows and totals after filtering.',
            'TransactionHistoryResponse',
            {
              all: { value: history },
              credits: {
                value: {
                  data: [creditCreated.data.transaction],
                  pagination: { page: 1, limit: 20, total_records: 1, total_pages: 1 },
                },
              },
              empty: {
                value: {
                  data: [],
                  pagination: { page: 1, limit: 20, total_records: 0, total_pages: 0 },
                },
              },
              beyondLast: {
                value: {
                  data: [],
                  pagination: { page: 3, limit: 1, total_records: 2, total_pages: 2 },
                },
              },
            },
          ),
          ...failures({ '400': 'Validation', '404': 'MissingAccount', '500': 'Internal' }),
        },
      },
    },
    '/transfers': {
      post: {
        tags: ['Transfers'],
        operationId: 'createTransfer',
        summary: 'Bonus: atomically transfer between two accounts',
        description:
          'Source and destination must be distinct existing UUIDs; IDs are normalized to lowercase. Locks are acquired in UUID order. One ACID transaction inserts the transfer, debits source, credits destination and inserts both linked legs. Any known rejection or write/validation/COMMIT rollback leaves neither partial balances nor ledger entries. Source insufficiency/destination overflow return 422. (source_account_id, reference_id) is persistently unique: repetition returns DUPLICATE_TRANSFER even with a changed destination/payload. If either account already has the exact reference in its ledger, return DUPLICATE_TRANSACTION. Both legs retain the same reference; disjoint account pairs can reuse it. Duplicate checks precede funds checks; no success response is replayed. Preserve the original payload/reference for uncertain retries. Transfers/legs cannot be updated/deleted through the API.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: schema('CreateTransferRequest'),
              examples: { transfer: { value: transferRequest } },
            },
          },
        },
        responses: {
          '201': success(
            'All transfer writes committed. Example assumes source balance 100.00 and destination balance 0.00 before transfer.',
            'CreateTransferResponse',
            { completed: { value: transferCreated } },
          ),
          ...failures({
            ...mutationErrors,
            '404': 'MissingAccount',
            '409': 'DuplicateTransfer',
            '422': 'BalanceGuard',
          }),
        },
      },
    },
  },
  components: { schemas, responses: errors },
};
