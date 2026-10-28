/** Remembers only the selected account in this tab; unresolved write intents survive logging out. */
import { ApplicationError, reportError } from '../../../errors/index.js';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { accountIdParamsSchema, accountNameSchema } from '@ledger/contracts';
import { ActiveAccountContext, type ActiveAccount } from '../hooks/index.js';
const key = 'transaction-ledger:active-account';
/** Discards corrupt storage rather than treating browser state as verified account data. */
function restore(): ActiveAccount | undefined {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (typeof value !== 'object' || !value || !('id' in value)) return;
    const id = accountIdParamsSchema.safeParse({ accountId: value.id });
    if (!id.success) return;
    const name = accountNameSchema.safeParse('name' in value ? value.name : undefined);
    return { id: id.data.accountId.toLowerCase(), name: name.success ? name.data : undefined };
  } catch (error: unknown) {
    reportError(
      new ApplicationError('Session data could not be read', 'STORAGE_UNAVAILABLE', 0, {
        cause: error,
      }),
      'session.read',
    );
    return;
  }
}
/** Storage failure affects remembered navigation only; it never authorizes a financial write. */
function remember(account: ActiveAccount | undefined) {
  try {
    if (account) sessionStorage.setItem(key, JSON.stringify(account));
    else sessionStorage.removeItem(key);
  } catch (error: unknown) {
    reportError(
      new ApplicationError('Session selection could not be stored', 'STORAGE_UNAVAILABLE', 0, {
        cause: error,
      }),
      'session.selection',
    );
  }
}
/** Owns the session selection independently of account reads and all money state. */
export function ActiveAccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState(restore);
  const select = useCallback((next: ActiveAccount) => {
    setAccount((current) => {
      const id = next.id.toLowerCase();
      const name = next.name ?? (current?.id === id ? current.name : undefined);
      if (current?.id === id && current.name === name) return current;
      const value = { id, name };
      remember(value);
      return value;
    });
  }, []);
  const forget = useCallback((id?: string) => {
    setAccount((current) => {
      if (id && current?.id !== id.toLowerCase()) return current;
      remember(undefined);
      return undefined;
    });
  }, []);
  const value = useMemo(() => ({ account, select, forget }), [account, select, forget]);
  return <ActiveAccountContext.Provider value={value}>{children}</ActiveAccountContext.Provider>;
}
