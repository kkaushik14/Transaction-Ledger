/** Application entry is routing-only; complete components are assembled in the route pages. */
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './app/routes';
/** Connects browser history to the approved v0.2 route map. */
export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
