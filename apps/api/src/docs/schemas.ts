/** Projects shared wire contracts to OpenAPI 3.1 JSON Schema; documents custom normalization rules. */
import { z } from 'zod';
import type * as OpenAPI from 'openapi3-ts/oas31';
import {
  accountNameSchema,
  transactionAmountSchema,
  transactionReferenceSchema,
  transactionDescriptionSchema,
  transactionSchema,
  createAccountRequestSchema,
  createAccountResponseSchema,
  accountBalanceResponseSchema,
  createTransactionRequestSchema,
  createTransactionResponseSchema,
  transactionHistoryResponseSchema,
  createTransferRequestSchema,
  createTransferResponseSchema,
  apiErrorResponseSchema,
  accountIdParamsSchema,
} from '@ledger/contracts';

/** Input transforms describe accepted JSON, while response schemas describe normalized JSON. */
function project(contract: z.ZodType, io: 'input' | 'output'): OpenAPI.SchemaObject {
  return z.toJSONSchema(contract, {
    io,
    override: ({ zodSchema, jsonSchema }) => {
      if (zodSchema === accountNameSchema) {
        jsonSchema.description =
          'Trim surrounding whitespace before validating 1–120 Unicode code points. Names need not be unique. NUL is forbidden.';
        // Express trimmed-length semantics without rejecting legal surrounding whitespace.
        jsonSchema.pattern =
          io === 'input'
            ? '^\\s*[^\\s\\u0000](?:[^\\u0000]{0,118}[^\\s\\u0000])?\\s*$'
            : '^[^\\u0000]+$';
        if (io === 'output') jsonSchema.maxLength = 120;
      }
      if (zodSchema === transactionAmountSchema) {
        jsonSchema.not = { enum: ['0', '0.0', '0.00'] };
        jsonSchema.description =
          'Positive decimal string, up to 18 integer and two fractional digits; normalized to two decimals. Maximum 999999999999999999.99. JSON numbers, signs, whitespace, exponent notation, leading zeros and extra precision are rejected.';
      }
      if (zodSchema === transactionSchema.shape.amount) jsonSchema.not = { const: '0.00' };
      if (zodSchema === transactionReferenceSchema) {
        jsonSchema.minLength = 1;
        jsonSchema.maxLength = 128;
        jsonSchema.pattern = '^(?![\\s\\S]*\\u0000)(?=[\\s\\S]*\\S)[\\s\\S]*$';
        jsonSchema.description =
          'Nonblank, case-sensitive reference, 1–128 Unicode code points. Preserved exactly, including surrounding whitespace; NUL is forbidden. Reuse the original value for a retry.';
      }
      if (zodSchema === transactionDescriptionSchema) {
        jsonSchema.maxLength = 500;
        jsonSchema.pattern = '^[^\\u0000]*$';
        jsonSchema.description =
          'Up to 500 Unicode code points, without NUL. Defaults to the empty string when omitted.';
      }
    },
  }) as OpenAPI.SchemaObject;
}

/** Response DTOs and strict request bodies keep their owning shared schemas instead of parallel shapes. */
export const schemas = {
  CreateAccountRequest: project(createAccountRequestSchema, 'input'),
  CreateAccountResponse: project(createAccountResponseSchema, 'output'),
  AccountBalanceResponse: project(accountBalanceResponseSchema, 'output'),
  CreateTransactionRequest: project(createTransactionRequestSchema, 'input'),
  CreateTransactionResponse: project(createTransactionResponseSchema, 'output'),
  TransactionHistoryResponse: project(transactionHistoryResponseSchema, 'output'),
  CreateTransferRequest: {
    ...project(createTransferRequestSchema, 'input'),
    description:
      'Source and destination must be different existing UUIDs (case-insensitive identity). Both IDs are normalized to lowercase. Amount, description and reference rules match standalone transactions.',
  },
  CreateTransferResponse: {
    ...project(createTransferResponseSchema, 'output'),
    description:
      'Exactly one correlated debit and credit: distinct leg IDs; matching transfer ID, amount, reference and description; debit/source and credit/destination identities. Balances are committed snapshots, not future current balances.',
  },
  ApiErrorResponse: project(apiErrorResponseSchema, 'output'),
  AccountId: project(accountIdParamsSchema.shape.accountId, 'input'),
} satisfies Record<string, OpenAPI.SchemaObject>;
