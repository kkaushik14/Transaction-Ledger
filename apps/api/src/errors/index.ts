/** HTTP-safe application errors shared across API modules. Explicit exports define this folder's public boundary. */
export { ApiError } from './api-error.js';

export {
  AccountNotFoundError,
  DuplicateReferenceError,
  InsufficientBalanceError,
  BalanceLimitError,
  InputValidationError,
} from './domain-errors.js';
export {
  logError,
  createErrorLogger,
  getLoggingFailures,
  logInternalError,
  serializeDiagnostic,
  type ErrorLogger,
  type ErrorLogRecord,
} from './diagnostics.js';
