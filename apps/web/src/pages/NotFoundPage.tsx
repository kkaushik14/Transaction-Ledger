/** Route failures reuse the same four-field mapped recovery UI as all application errors. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, ErrorNotice } from '../components/ui/index.js';
import { ApplicationError, reportError } from '../errors/index.js';
/** No route identifiers, stack traces or internal paths are interpolated into public copy. */
export function NotFoundPage({ invalidAccount = false }: { invalidAccount?: boolean }) {
  const navigate = useNavigate();
  const [error] = useState(() =>
    reportError(
      new ApplicationError(
        'Route could not be opened',
        invalidAccount ? 'INVALID_ACCOUNT_ID' : 'ROUTE_NOT_FOUND',
      ),
      'route.not-found',
    ),
  );
  return (
    <Container>
      <div className="recovery">
        <ErrorNotice
          error={error}
          onFixInput={() => navigate('/#get-started', { state: { entry: 'lookup' } })}
          onGoBack={() => navigate('/')}
        />
      </div>
    </Container>
  );
}
