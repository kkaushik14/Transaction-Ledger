/** Local validation maps issue identities to allowlisted codes; raw Zod messages never become public UI. */
import type { ZodIssue } from 'zod';
import { ApplicationError } from './application-error.js';
import { reportError } from './diagnostics.js';
/** Chooses one actionable first field while all invalid controls remain marked for correction. */
export function validationError(issues: readonly ZodIssue[]): ApplicationError {
  const issue = issues[0];
  const field = String(issue?.path[0]);
  const code =
    field === 'name'
      ? 'INVALID_ACCOUNT_NAME'
      : field === 'amount'
        ? 'INVALID_AMOUNT'
        : field === 'description'
          ? 'INVALID_DESCRIPTION'
          : field === 'destination_account_id' && issue?.code === 'custom'
            ? 'SELF_TRANSFER'
            : field === 'destination_account_id' || field === 'accountId'
              ? 'INVALID_ACCOUNT_ID'
              : 'VALIDATION_ERROR';
  return reportError(
    new ApplicationError('Local validation failed', code, 0, {
      cause: { name: 'InputValidation', code: issue?.code, field },
    }),
    'form.validation',
  );
}
