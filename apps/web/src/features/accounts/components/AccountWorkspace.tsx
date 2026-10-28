/** Composes verified domain components and hooks; server reads remain authoritative after every write. */
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Card, Skeleton, ErrorNotice } from '../../../components/ui/index.js';

import { useAccount, useActiveAccount } from '../hooks/index.js';
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
  const navigate = useNavigate();
  const account = useAccount(accountId);
  const history = useTransactions(accountId);
  const active = useActiveAccount();
  const select = active?.select;
  const forget = active?.forget;
  useEffect(() => {
    if (account.data) select?.({ id: accountId, name });
    else if (account.error?.code === 'ACCOUNT_NOT_FOUND') forget?.(accountId);
  }, [account.data, account.error, accountId, name, select, forget]);
  const combinedFailure = Boolean(account.error && history.error);
  const relatedErrors = history.error ? [history.error] : undefined;
  const refresh = () => {
    account.refresh();
    history.refreshAfterMutation();
  };
  return (
    <>
      <AccountPageHeader
        accountId={accountId}
        name={name ?? (active?.account?.id === accountId ? active.account.name : undefined)}
      />
      {account.error && !account.data ? (
        <ErrorNotice
          error={account.error}
          context={combinedFailure ? 'account-data' : 'balance'}
          relatedErrors={combinedFailure ? relatedErrors : undefined}
          onRetry={combinedFailure ? refresh : account.refresh}
          onGoBack={() => navigate('/#get-started', { state: { entry: 'lookup' } })}
        />
      ) : !account.data ? (
        <Skeleton variant="balance" />
      ) : (
        <>
          <AccountBalanceCard
            balance={account.data.data.balance}
            refreshing={account.loading}
            stale={Boolean(account.error)}
          />
          {account.error && (
            <div className="stack account-status">
              <ErrorNotice
                error={account.error}
                context={combinedFailure ? 'account-data' : 'balance'}
                relatedErrors={combinedFailure ? relatedErrors : undefined}
                onRetry={combinedFailure ? refresh : account.refresh}
                onGoBack={() => navigate('/#get-started', { state: { entry: 'lookup' } })}
              />
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
                error={history.error}
                errorReported={combinedFailure}
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
