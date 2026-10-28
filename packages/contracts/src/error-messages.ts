/** Exhaustive allowlisted messages are the only source of user-facing error copy. */
import type { ErrorCode, ErrorAction } from './errors.contract.js';
export type ErrorContext =
  | 'general'
  | 'account-create'
  | 'balance'
  | 'history'
  | 'transaction'
  | 'transfer'
  | 'account-data';
interface Presentation {
  message: string;
  action: ErrorAction;
}
/** Known codes have specific instructions; raw Error.message and HTTP message text are never rendered. */
const messages = {
  VALIDATION_ERROR: {
    message: 'Check the entered details and correct any invalid values before continuing.',
    action: 'fix_input',
  },
  ACCOUNT_NOT_FOUND: {
    message: 'Account not found. Check the Account ID or open another account.',
    action: 'go_back',
  },
  DUPLICATE_TRANSACTION: {
    message:
      'Reference already used. This attempt made no new movement. Review the balance and history before starting another transaction.',
    action: 'review',
  },
  DUPLICATE_TRANSFER: {
    message:
      'Transfer reference already used. This attempt made no new transfer. The earlier result has not been confirmed; review the balance and history.',
    action: 'review',
  },
  INSUFFICIENT_BALANCE: {
    message:
      'The account has insufficient balance. Review the current balance and enter a smaller amount.',
    action: 'fix_input',
  },
  BALANCE_LIMIT_EXCEEDED: {
    message:
      'The amount would exceed the account balance limit. Enter a smaller amount or choose another destination.',
    action: 'fix_input',
  },
  ROUTE_NOT_FOUND: {
    message: 'We couldn’t find that page. Return to the overview and try an available destination.',
    action: 'go_back',
  },
  UNSUPPORTED_MEDIA_TYPE: {
    message: 'The request could not be accepted. Return to the form and submit your details again.',
    action: 'go_back',
  },
  PAYLOAD_TOO_LARGE: {
    message: 'The entered details are too long. Shorten them before trying again.',
    action: 'fix_input',
  },
  INTERNAL_ERROR: {
    message:
      'Something went wrong. Try again later. If this continues, share the support ticket ID when requesting help.',
    action: 'retry',
  },
  NETWORK_ERROR: {
    message: 'We could not connect. Check your connection and try again.',
    action: 'retry',
  },
  INVALID_RESPONSE: {
    message: 'We could not confirm the result. Review the account before trying again.',
    action: 'retry',
  },
  CONFIGURATION_ERROR: {
    message:
      'This service is currently unavailable. Go back and try again later, or share the support ticket ID when requesting help.',
    action: 'go_back',
  },
  STORAGE_UNAVAILABLE: {
    message:
      'Retry details could not be saved. Allow browser session storage, then try again. No new request was sent.',
    action: 'retry',
  },
  INVALID_ACCOUNT_ID: {
    message:
      'Enter a valid Account ID. Copy the complete ID provided when the account was created.',
    action: 'fix_input',
  },
  INVALID_ACCOUNT_NAME: {
    message:
      'Enter an account name with 1–120 characters. Names cannot be blank or contain unsupported characters.',
    action: 'fix_input',
  },
  INVALID_AMOUNT: {
    message:
      'Enter a positive amount with up to two decimal places, within the account balance limit.',
    action: 'fix_input',
  },
  INVALID_DESCRIPTION: {
    message: 'Enter a description with no more than 500 characters and no unsupported characters.',
    action: 'fix_input',
  },
  SELF_TRANSFER: {
    message:
      'Choose a different destination Account ID. Source and destination must be different accounts.',
    action: 'fix_input',
  },
  CLIPBOARD_UNAVAILABLE: {
    message:
      'Could not copy the Account ID. Select the displayed ID to copy it manually, or retry.',
    action: 'retry',
  },
  ACCOUNT_CREATION_UNCONFIRMED: {
    message:
      'We could not confirm whether the account was created. Retrying may create another account. Go back and use an existing Account ID if available.',
    action: 'go_back',
  },
} satisfies Record<ErrorCode, Presentation>;
/** Operation context gives safe write recovery without misrepresenting a conflict as a successful replay. */
export function resolveErrorMessage(
  code: ErrorCode,
  context: ErrorContext = 'general',
  uncertain = false,
): Presentation {
  if (context === 'account-create' && uncertain) return messages.ACCOUNT_CREATION_UNCONFIRMED;
  if (uncertain && code === 'STORAGE_UNAVAILABLE')
    return {
      message:
        'Retry details could not be saved. Allow browser session storage before retrying the original request. Its earlier result remains unconfirmed; review your balance and history first.',
      action: 'retry',
    };
  if (uncertain && code === 'CONFIGURATION_ERROR')
    return {
      message:
        'The service is currently unavailable. Try again later using the same saved request. Its earlier result remains unconfirmed.',
      action: 'retry',
    };
  if (uncertain && (context === 'transaction' || context === 'transfer'))
    return {
      message: `${context === 'transfer' ? 'Transfer result unconfirmed.' : 'Result not confirmed.'} The earlier request may already be recorded. Review the balance and history, or retry the same request with its original details.`,
      action: 'retry',
    };
  if (context === 'transfer' && code === 'ACCOUNT_NOT_FOUND')
    return {
      message:
        'Source or destination account not found. Check both Account IDs before trying again.',
      action: 'fix_input',
    };
  if (context === 'transfer' && code === 'DUPLICATE_TRANSACTION')
    return messages.DUPLICATE_TRANSFER;
  if (
    context === 'account-data' &&
    ['NETWORK_ERROR', 'INTERNAL_ERROR', 'INVALID_RESPONSE'].includes(code)
  )
    return {
      message:
        'Account data could not be refreshed. Retry to update both the balance and transaction history. Any shown balance is the last confirmed value.',
      action: 'retry',
    };
  if (
    context === 'balance' &&
    ['NETWORK_ERROR', 'INTERNAL_ERROR', 'INVALID_RESPONSE'].includes(code)
  )
    return {
      message:
        'Balance refresh failed. Retry to get the latest balance. Any shown balance is the last confirmed value.',
      action: 'retry',
    };
  if (
    context === 'history' &&
    ['NETWORK_ERROR', 'INTERNAL_ERROR', 'INVALID_RESPONSE'].includes(code)
  )
    return {
      message: 'History could not be refreshed. Retry to load the latest entries.',
      action: 'retry',
    };
  return messages[code] ?? messages.INTERNAL_ERROR;
}
/** Exhaustive action labels keep inaccessible or misleading recovery controls out of individual screens. */
export function resolveActionLabel(
  action: ErrorAction,
  context: ErrorContext = 'general',
  uncertain = false,
): string {
  switch (action) {
    case 'retry':
      return uncertain && context === 'transfer'
        ? 'Retry same transfer'
        : uncertain && context === 'transaction'
          ? 'Retry same request'
          : context === 'account-data'
            ? 'Retry account'
            : context === 'balance'
              ? 'Retry balance'
              : context === 'history'
                ? 'Retry history'
                : 'Retry';
    case 'go_back':
      return 'Go Back';
    case 'review':
      return 'Review account';
    case 'fix_input':
      return 'Review details';
    case 'reload':
      return 'Reload';
    default:
      return assertNever(action);
  }
}
/** Compile-time exhaustiveness for closed error/action unions. */
export function assertNever(value: never): never {
  throw new Error(`Unhandled error action: ${String(value)}`);
}
