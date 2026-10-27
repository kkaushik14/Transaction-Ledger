/** Composes verified domain components and hooks; server reads remain authoritative after every write. */
import { Card } from '../../../components/ui/Card';
import { LoadingState } from '../../../components/ui/LoadingState';
import { StatusMessage } from '../../../components/ui/StatusMessage';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { useAccount } from '../hooks/useAccount';
import { useTransactions } from '../../transactions/hooks/useTransactions';
import { AccountPageHeader } from './AccountPageHeader';
import { AccountBalanceCard } from './AccountBalanceCard';
import { TransactionForm } from '../../transactions/components/TransactionForm';
import { TransactionHistory } from '../../transactions/components/TransactionHistory';
/** Selected-account workspace; parent keys it by UUID so form/read state cannot cross accounts. */
export function AccountWorkspace({
  accountId,
  name,
}: {
  accountId: string;
  name?: string | undefined;
}) {
  const account = useAccount(accountId);
  const history = useTransactions(accountId);
  const refresh = () => {
    account.refresh();
    history.refreshAfterMutation();
  };
  return (
    <>
      <AccountPageHeader accountId={accountId} name={name} />
      {account.error ? (
        <div className="stack">
          <StatusMessage
            tone="error"
            title={
              account.error.code === 'ACCOUNT_NOT_FOUND'
                ? 'Account not found'
                : 'Could not load account'
            }
          >
            {account.error.code === 'ACCOUNT_NOT_FOUND'
              ? 'Check the account ID or open another account.'
              : account.error.message}
          </StatusMessage>
          <div className="inline-actions">
            <ButtonLink to="/#get-started" state={{ entry: 'lookup' }}>
              Open another account
            </ButtonLink>
            <Button variant="secondary" onClick={account.refresh}>
              Retry account
            </Button>
          </div>
        </div>
      ) : !account.data ? (
        <LoadingState label="Loading account balance…" />
      ) : (
        <>
          <AccountBalanceCard balance={account.data.data.balance} refreshing={account.loading} />
          <div className="account-workspace">
            <Card>
              <TransactionForm accountId={accountId} onChanged={refresh} />
            </Card>
            <Card>
              <TransactionHistory
                data={history.data}
                loading={history.loading}
                error={history.error?.message}
                filter={history.filter}
                onFilter={history.changeFilter}
                onPage={history.changePage}
                onRetry={history.refresh}
              />
            </Card>
          </div>
        </>
      )}
    </>
  );
}
