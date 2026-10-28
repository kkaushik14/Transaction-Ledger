/** Composes verified domain components and hooks; server reads remain authoritative after every write. */
import {
  Card,
  LoadingState,
  StatusMessage,
  Button,
  ButtonLink,
} from '../../../components/ui/index.js';

import { useAccount } from '../hooks/index.js';
import { useTransactions, TransactionForm, TransactionHistory } from '../../transactions/index.js';
import { TransferForm } from '../../transfers/index.js';
import { AccountPageHeader } from './AccountPageHeader';
import { AccountBalanceCard } from './AccountBalanceCard';

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
      {account.error && !account.data ? (
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
          <AccountBalanceCard
            balance={account.data.data.balance}
            refreshing={account.loading}
            stale={Boolean(account.error)}
          />
          {account.error && (
            <div className="stack account-status">
              <StatusMessage tone="error" title="Balance refresh failed">
                The shown balance is the last confirmed value. Retry updates this view without
                sending funds.
              </StatusMessage>
              <Button variant="secondary" onClick={account.refresh}>
                Retry balance
              </Button>
            </div>
          )}
          <div className="account-workspace">
            <div className="stack">
              <Card>
                <TransactionForm accountId={accountId} onChanged={refresh} />
              </Card>
              <Card>
                <TransferForm sourceAccountId={accountId} onChanged={refresh} />
              </Card>
            </div>
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
