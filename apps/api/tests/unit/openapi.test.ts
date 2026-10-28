/** Validates the primary OpenAPI document, every example and projections against the real shared contracts. */
import SwaggerParser from '@apidevtools/swagger-parser';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { fullFormats } from 'ajv-formats/dist/formats.js';
import type * as OpenAPI from 'openapi3-ts/oas31';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  createAccountRequestSchema,
  createAccountResponseSchema,
  accountBalanceResponseSchema,
  createTransactionRequestSchema,
  createTransactionResponseSchema,
  transactionHistoryResponseSchema,
  createTransferRequestSchema,
  createTransferResponseSchema,
  apiErrorResponseSchema,
  apiErrorCodeSchema,
} from '@ledger/contracts';
import { openApiV1 } from '../../src/docs/index.js';

const contracts: Record<string, z.ZodType> = {
  CreateAccountRequest: createAccountRequestSchema,
  CreateAccountResponse: createAccountResponseSchema,
  AccountBalanceResponse: accountBalanceResponseSchema,
  CreateTransactionRequest: createTransactionRequestSchema,
  CreateTransactionResponse: createTransactionResponseSchema,
  TransactionHistoryResponse: transactionHistoryResponseSchema,
  CreateTransferRequest: createTransferRequestSchema,
  CreateTransferResponse: createTransferResponseSchema,
  ApiErrorResponse: apiErrorResponseSchema,
};
const ajv = new Ajv2020({ strict: false, allErrors: true, formats: fullFormats });
ajv.addSchema(openApiV1, 'ledger');
/** Local component refs are resolved by the validator; no remote schemas or production services are involved. */
function validator(name: string) {
  return ajv.compile({ $ref: `ledger#/components/schemas/${name}` });
}
/** Returns every documented business operation, preserving method/path context in failures. */
function operations() {
  return Object.entries(openApiV1.paths ?? {}).flatMap(([path, item]) =>
    ['get', 'post'].flatMap((method) => {
      const operation = item?.[method as 'get' | 'post'];
      return operation ? [{ path, method, operation }] : [];
    }),
  );
}
/** Resolves a typed local response component without mutating the primary document. */
function response(value: OpenAPI.ResponseObject | OpenAPI.ReferenceObject): OpenAPI.ResponseObject {
  if ('$ref' in value) {
    const found = openApiV1.components?.responses?.[value.$ref.split('/').at(-1) ?? ''];
    if (!found || '$ref' in found) throw new Error('Unresolved response component');
    return found;
  }
  return value;
}
/** Tests one media type's examples both as JSON Schema and through its actual runtime Zod owner. */
function examples(media: OpenAPI.MediaTypeObject) {
  if (!media.schema || !('$ref' in media.schema))
    throw new Error('Expected a local wire schema reference');
  const name = media.schema.$ref.split('/').at(-1) ?? '';
  const validate = validator(name),
    contract = contracts[name];
  if (!contract) throw new Error(`No shared wire owner for ${name}`);
  expect(Object.keys(media.examples ?? {})).not.toHaveLength(0);
  for (const [label, example] of Object.entries(media.examples ?? {})) {
    if ('$ref' in example) throw new Error('Examples must be self-contained');
    expect(validate(example.value), `${name}/${label}: ${ajv.errorsText(validate.errors)}`).toBe(
      true,
    );
    expect(contract.safeParse(example.value).success, `${name}/${label}`).toBe(true);
  }
}

describe('versioned OpenAPI v1', () => {
  it('is valid OpenAPI 3.1, has only local refs and documents exactly the implemented operations', async () => {
    // Parser dereferences its input; clone through the serialized wire form to keep the source immutable.
    await expect(
      SwaggerParser.validate(JSON.parse(JSON.stringify(openApiV1)), {
        resolve: { external: false },
      }),
    ).resolves.toBeDefined();
    expect(openApiV1.openapi).toBe('3.1.0');
    expect(openApiV1.info.version).toBe('1.0.0');
    expect(openApiV1.servers).toEqual([{ url: '/api/v1', description: expect.any(String) }]);
    expect(
      operations()
        .map(({ path, method }) => `${method.toUpperCase()} ${path}`)
        .sort(),
    ).toEqual([
      'GET /accounts/{accountId}/balance',
      'GET /accounts/{accountId}/transactions',
      'POST /accounts',
      'POST /accounts/{accountId}/transactions',
      'POST /transfers',
    ]);
    const refs = [...JSON.stringify(openApiV1).matchAll(/"\$ref":"([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(refs.every((ref) => ref?.startsWith('#/components/'))).toBe(true);
    expect(new Set(operations().map(({ operation }) => operation.operationId)).size).toBe(5);
  });
  it('keeps all request, success, pagination and error examples valid against both documented and runtime schemas', () => {
    for (const { operation } of operations()) {
      const body = operation.requestBody;
      if (body && !('$ref' in body))
        for (const media of Object.values(body.content)) examples(media);
      for (const value of Object.values(operation.responses ?? {}))
        for (const media of Object.values(response(value).content ?? {})) examples(media);
    }
  });
  it('documents every server error code with the four-field envelope, header correlation and known status mappings', () => {
    const codes = new Set<string>();
    for (const value of Object.values(openApiV1.components?.responses ?? {})) {
      const item = response(value);
      expect(item.headers?.['X-Support-Ticket-ID']).toBeDefined();
      for (const example of Object.values(item.content?.['application/json']?.examples ?? {})) {
        if ('$ref' in example) throw new Error('Expected inline error example');
        const parsed = apiErrorResponseSchema.parse(example.value);
        codes.add(parsed.error.code);
        expect(Object.keys(parsed.error).sort()).toEqual([
          'action',
          'code',
          'message',
          'support_ticket_id',
        ]);
      }
    }
    expect([...codes].sort()).toEqual([...apiErrorCodeSchema.options].sort());
    const transfer = openApiV1.paths?.['/transfers']?.post;
    expect(Object.keys(transfer?.responses ?? {}).sort()).toEqual([
      '201',
      '400',
      '404',
      '409',
      '413',
      '415',
      '422',
      '500',
    ]);
    expect(transfer?.description).toContain('DUPLICATE_TRANSACTION');
    expect(transfer?.description).toContain('DUPLICATE_TRANSFER');
  });
  it('documents exact history defaults, filtering, safe offsets and latest-first snapshot boundaries', () => {
    const operation = openApiV1.paths?.['/accounts/{accountId}/transactions']?.get;
    const parameters = operation?.parameters?.filter(
      (parameter): parameter is OpenAPI.ParameterObject => !('$ref' in parameter),
    );
    expect(parameters?.find((parameter) => parameter.name === 'page')?.schema).toMatchObject({
      type: 'integer',
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
      default: 1,
    });
    expect(parameters?.find((parameter) => parameter.name === 'limit')?.schema).toMatchObject({
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 20,
    });
    expect(parameters?.find((parameter) => parameter.name === 'type')?.schema).toMatchObject({
      enum: ['credit', 'debit'],
    });
    expect(operation?.description).toContain('created_at DESC, id DESC');
    expect(operation?.description).toContain('Separate page requests');
    expect(operation?.description).toContain('(page-1)*limit');
  });
  it.each(['0', '0.0', '0.00', '-1', '1.001', '1e2', 1, '1000000000000000000'])(
    'rejects invalid documented monetary input %j consistently with the API',
    (amount) => {
      for (const name of ['CreateTransactionRequest', 'CreateTransferRequest']) {
        const operation =
          name === 'CreateTransactionRequest'
            ? openApiV1.paths?.['/accounts/{accountId}/transactions']?.post
            : openApiV1.paths?.['/transfers']?.post;
        const body = operation?.requestBody;
        if (!body || '$ref' in body) throw new Error('Missing request body');
        const example = Object.values(body.content['application/json']?.examples ?? {})[0];
        if (!example || '$ref' in example) throw new Error('Missing example');
        const value = { ...example.value, amount };
        expect(validator(name)(value)).toBe(false);
        expect(contracts[name]?.safeParse(value).success).toBe(false);
      }
    },
  );
  it.each(['  Alex Morgan  ', `  ${'😀'.repeat(120)}\t`, 'Ålex\nMorgan'])(
    'accepts valid Unicode/trimmed account names %j without a stricter raw-length limit',
    (name) => {
      expect(validator('CreateAccountRequest')({ name })).toBe(true);
      expect(createAccountRequestSchema.safeParse({ name }).success).toBe(true);
    },
  );
  it.each(['   ', '😀'.repeat(121), 'bad\0name'])(
    'rejects invalid documented names consistently with the API',
    (name) => {
      expect(validator('CreateAccountRequest')({ name })).toBe(false);
      expect(createAccountRequestSchema.safeParse({ name }).success).toBe(false);
    },
  );
});
