/** Browser error boundary: typed failures, private diagnostics and safe validation mapping. */
export { ApplicationError, ApiClientError, asApplicationError } from './application-error.js';
export { reportError, getErrorDiagnostics, runSafely, publishError } from './diagnostics.js';
export type { ClientErrorDiagnostic } from './diagnostics.js';
export { validationError } from './validation.js';
export { renderFatalError } from './fatal-error.js';
