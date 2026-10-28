/** Dependency-free final fallback for failures before React or its boundaries can mount. */
import { resolveActionLabel, resolveErrorMessage } from '@ledger/contracts';
import { reportError } from './diagnostics.js';
/** Uses textContent only, with the same four public fields; never inserts an error as HTML. */
export function renderFatalError(error: unknown): void {
  const failure = reportError(error, 'browser.bootstrap');
  const presentation = resolveErrorMessage(failure.code);
  const container = document.getElementById('root') ?? document.body;
  const panel = document.createElement('main');
  panel.className = 'recovery';
  panel.setAttribute('role', 'alert');
  for (const value of [
    presentation.message,
    `Error code: ${failure.code}`,
    `Support ticket ID: ${failure.supportTicketId}`,
  ]) {
    const paragraph = document.createElement('p');
    paragraph.textContent = value;
    panel.append(paragraph);
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = resolveActionLabel(presentation.action);
  button.addEventListener('click', () => {
    if (['go_back', 'review', 'fix_input'].includes(presentation.action))
      window.location.assign('/#get-started');
    else window.location.reload();
  });
  panel.append(button);
  container.replaceChildren(panel);
}
