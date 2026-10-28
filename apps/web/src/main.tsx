/** Installs sanitized React diagnostics and a last-resort bootstrap recovery view. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './index.js';
import { reportError, renderFatalError } from './errors/index.js';
import './styles/index.js';
try {
  const container = document.getElementById('root');
  if (!container) throw new Error('Missing root element');
  createRoot(container, {
    onCaughtError: (error: unknown) => {
      reportError(error, 'react.caught');
    },
    onUncaughtError: (error: unknown) => {
      renderFatalError(error);
    },
    onRecoverableError: (error: unknown) => {
      reportError(error, 'react.recovered');
    },
  }).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (error: unknown) {
  renderFatalError(error);
}
