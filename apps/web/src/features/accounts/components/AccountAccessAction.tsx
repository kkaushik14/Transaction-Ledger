/** Shared header/drawer action changes with the selected workspace and preserves financial retries. */
import { runSafely } from '../../../errors/index.js';
import { useNavigate } from 'react-router-dom';
import { Button, ButtonLink } from '../../../components/ui/index.js';
import { useActiveAccount } from '../hooks/index.js';
/** Logging out clears tab selection only; re-entering an Account ID opens the same stored ledger. */
export function AccountAccessAction({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const active = useActiveAccount();
  const navigate = useNavigate();
  if (!active?.account)
    return (
      <ButtonLink
        className={className}
        to="/#get-started"
        state={{ entry: 'create' }}
        onClick={onNavigate}
      >
        Create an account
      </ButtonLink>
    );
  return (
    <Button
      className={className}
      variant="secondary"
      onClick={() => {
        active.forget();
        onNavigate?.();
        runSafely(
          () => navigate('/', { replace: true, state: { loggedOut: true } }),
          'account.logout.navigation',
        );
      }}
    >
      Log out
    </Button>
  );
}
