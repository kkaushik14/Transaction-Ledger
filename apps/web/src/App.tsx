/** Application entry is routing-only; complete components are assembled in the route pages. */
import { BrowserRouter } from 'react-router-dom';
import { ApplicationErrorBoundary, GlobalErrorHandler } from './components/layout/index.js';
import { AppRoutes } from './app/index.js';
/** Connects browser history to the approved v0.2 route map. */
export function App() {
  return (
    <ApplicationErrorBoundary>
      <GlobalErrorHandler>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </GlobalErrorHandler>
    </ApplicationErrorBoundary>
  );
}
