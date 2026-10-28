/** Route-only account page validates identity and composes the existing workspace; no raw fetches. */
import { useLocation, useParams } from 'react-router-dom';
import { accountIdParamsSchema, accountNameSchema } from '@ledger/contracts';
import { Container } from '../components/ui/index.js';
import { AccountWorkspace } from '../features/accounts/index.js';
import { NotFoundPage } from './NotFoundPage';
/** Uses creation metadata only when it belongs to this UUID; direct lookup has an honest fallback. */
export function AccountPage() {
  const params = useParams();
  const location = useLocation();
  const parsed = accountIdParamsSchema.safeParse({ accountId: params.accountId });
  if (!parsed.success) return <NotFoundPage invalidAccount />;
  const accountId = parsed.data.accountId.toLowerCase();
  const metadata: unknown = location.state;
  let name: string | undefined;
  if (
    typeof metadata === 'object' &&
    metadata !== null &&
    'accountId' in metadata &&
    typeof metadata.accountId === 'string' &&
    metadata.accountId.toLowerCase() === accountId &&
    'accountName' in metadata
  ) {
    const known = accountNameSchema.safeParse(metadata.accountName);
    if (known.success) name = known.data;
  }
  return (
    <Container className="account-page">
      <AccountWorkspace key={accountId} accountId={accountId} name={name} />
    </Container>
  );
}
