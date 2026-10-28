/** Last-resort render and asynchronous browser boundaries preserve private causes and show a single safe screen. */
import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { ApplicationError, asApplicationError, reportError } from '../../errors/index.js';
import { Container, ErrorNotice } from '../ui/index.js';
/** Class boundary is required by React for descendant render/lifecycle exceptions. */
export class ApplicationErrorBoundary extends Component<
  { children: ReactNode },
  { error?: ApplicationError }
> {
  state: { error?: ApplicationError } = {};
  static getDerivedStateFromError(error: unknown) {
    return { error: asApplicationError(error) };
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    reportError(
      this.state.error ??
        new ApplicationError('Render failed', 'INTERNAL_ERROR', 0, {
          cause: new Error(info.componentStack ?? 'Render failed', { cause: error }),
        }),
      'react.render',
    );
  }
  render() {
    return this.state.error ? (
      <main className="recovery">
        <Container>
          <ErrorNotice error={this.state.error} />
        </Container>
      </main>
    ) : (
      this.props.children
    );
  }
}
/** Browser event/rejection failures use the same component; handled request failures stay local to their feature. */
export function GlobalErrorHandler({ children }: { children: ReactNode }) {
  const [error, setError] = useState<ApplicationError>();
  useEffect(() => {
    const rejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      setError(reportError(event.reason as unknown, 'window.unhandledrejection'));
    };
    const failure = (event: ErrorEvent) => {
      event.preventDefault();
      setError(reportError(event.error as unknown, 'window.error'));
    };
    const reported = (event: Event) => {
      if (event instanceof CustomEvent)
        setError(reportError(event.detail as unknown, 'ui.callback'));
    };
    window.addEventListener('unhandledrejection', rejection);
    window.addEventListener('error', failure);
    window.addEventListener('ledger:unexpected-error', reported);
    return () => {
      window.removeEventListener('unhandledrejection', rejection);
      window.removeEventListener('error', failure);
      window.removeEventListener('ledger:unexpected-error', reported);
    };
  }, []);
  return error ? (
    <main className="recovery">
      <Container>
        <ErrorNotice error={error} />
      </Container>
    </main>
  ) : (
    children
  );
}
