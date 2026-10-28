/** Browser workspace selection is navigation state, never authentication or a cached balance. */
import { createContext, useContext } from 'react';
export interface ActiveAccount {
  id: string;
  name?: string | undefined;
}
export interface ActiveAccountState {
  account: ActiveAccount | undefined;
  select: (account: ActiveAccount) => void;
  forget: (id?: string) => void;
}
export const ActiveAccountContext = createContext<ActiveAccountState | undefined>(undefined);
/** Optional context keeps domain components usable independently of the application shell. */
export function useActiveAccount() {
  return useContext(ActiveAccountContext);
}
