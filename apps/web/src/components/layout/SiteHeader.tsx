/** Shared identity, desktop navigation, and accessible responsive menu trigger. */
import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Container, Icon, IconButton } from '../ui/index.js';
import { AccountAccessAction } from '../../features/accounts/index.js';

import { DesktopNav } from './DesktopNav';
import { ResponsiveSidebar } from './ResponsiveSidebar';
/** Owns only navigation state; drawer state never depends on financial data. */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  return (
    <header className="site-header">
      <Container className="header-inner">
        <Link className="site-logo" to="/" aria-label="Transaction Ledger home">
          <span className="logo-mark">
            <Icon name="ledger" />
          </span>
          Transaction Ledger
        </Link>
        <DesktopNav />
        <div className="header-actions">
          <AccountAccessAction className="header-cta" />
          <IconButton
            ref={trigger}
            className="nav-menu-button"
            label="Open navigation"
            icon="menu"
            variant="subtle"
            aria-expanded={open}
            aria-controls="site-sidebar"
            onClick={() => setOpen(true)}
          />
        </div>
        <ResponsiveSidebar open={open} onClose={close} triggerRef={trigger} />
      </Container>
    </header>
  );
}
