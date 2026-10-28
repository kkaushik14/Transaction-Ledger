/** Recoverable route/identifier error screen composed from the shared shell primitives. */
import { Container, ButtonLink, Icon } from '../components/ui/index.js';

/** Keeps malformed routes useful without inventing account data or leaving a blank screen. */
export function NotFoundPage({ invalidAccount = false }: { invalidAccount?: boolean }) {
  return (
    <Container>
      <div className="recovery">
        <p>LET’S GET YOU BACK</p>
        <h1>{invalidAccount ? 'This account ID is not valid.' : 'We couldn’t find that page.'}</h1>
        <p>
          {invalidAccount
            ? 'An account ID should be a complete UUID. Open an account using its ID, or create a new one.'
            : 'The page may have moved, or the address may be incomplete. Your next entry is still waiting.'}
        </p>
        <div className="inline-actions">
          <ButtonLink to="/#get-started" state={{ entry: 'lookup' }}>
            Open an account
            <Icon name="arrow" />
          </ButtonLink>
          <ButtonLink variant="secondary" to="/">
            Back to overview
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
