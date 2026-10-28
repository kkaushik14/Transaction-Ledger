/** Site landmarks and route/anchor focus management shared by every composed page. */
import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { StatusMessage, Container } from '../ui/index.js';
import { ActiveAccountProvider } from '../../features/accounts/index.js';
/** Applies navigation scroll/focus after drawer cleanup and keeps hash destinations functional. */
export function AppShell() {
  const location = useLocation();
  const previousKey = useRef<string | undefined>(undefined);
  useEffect(() => {
    const navigated = previousKey.current !== undefined && previousKey.current !== location.key;
    previousKey.current = location.key;
    document.title = location.pathname.startsWith('/accounts/')
      ? 'Account · Transaction Ledger'
      : 'Transaction Ledger · A clear view';
    const frame = requestAnimationFrame(() => {
      const target = location.hash
        ? document.getElementById(location.hash.slice(1))
        : document.getElementById('main-content');
      const entry: unknown = location.state;
      const focusLookup =
        typeof entry === 'object' && entry !== null && 'entry' in entry && entry.entry === 'lookup';
      const focusCreate =
        typeof entry === 'object' && entry !== null && 'entry' in entry && entry.entry === 'create';
      if (location.hash) target?.scrollIntoView({ block: 'start' });
      else window.scrollTo({ top: 0, behavior: 'instant' });
      // A user can start entering an Account ID before this deferred route focus
      // runs. Never steal that focus and drop the remaining keystrokes.
      const focused = document.activeElement;
      if (
        focused instanceof HTMLElement &&
        target?.contains(focused) &&
        focused.matches('input, select, textarea, button, a[href]')
      )
        return;
      if (location.hash === '#get-started' && (focusLookup || focusCreate)) {
        document
          .getElementById(focusLookup ? 'account-lookup-id' : 'account-create-name')
          ?.focus({ preventScroll: true });
        if (!document.getElementById(focusLookup ? 'account-lookup-id' : 'account-create-name'))
          target?.focus({ preventScroll: true });
      } else if (location.hash || navigated) target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.key, location.hash, location.pathname, location.state]);
  return (
    <ActiveAccountProvider>
      <div className="site-shell">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="site-main">
          {location.state &&
            typeof location.state === 'object' &&
            'loggedOut' in location.state &&
            location.state.loggedOut === true && (
              <Container className="account-status">
                <StatusMessage tone="success" title="Logged out">
                  Your ledger is saved. Enter your Account ID to return. This clears the browser
                  selection; Account ID access does not require sign-in.
                </StatusMessage>
              </Container>
            )}
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </ActiveAccountProvider>
  );
}
