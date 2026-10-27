/** Native modal navigation drawer with scroll locking, breakpoint reset, and focus restoration. */
import { useEffect, useRef, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { IconButton } from '../ui/IconButton';
import { ButtonLink } from '../ui/Button';
import { desktopMediaQuery, navigationLinks } from './navigation';
/** Drawer inputs remain presentational: layout never fetches account data. */
export interface ResponsiveSidebarProps {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}
/** Uses a native inert background and an explicit Tab loop to keep keyboard focus in the drawer. */
export function ResponsiveSidebar({ open, onClose, triggerRef }: ResponsiveSidebarProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = window.matchMedia(desktopMediaQuery());
    const reset = () => {
      if (media.matches) onClose();
    };
    media.addEventListener('change', reset);
    return () => media.removeEventListener('change', reset);
  }, [onClose]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!dialog.open) dialog.showModal();
    closeRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      // A hidden mobile trigger cannot receive focus after a desktop resize.
      if (window.matchMedia(desktopMediaQuery()).matches)
        document.querySelector<HTMLAnchorElement>('.site-logo')?.focus();
      else trigger?.focus();
    };
  }, [open, triggerRef]);
  return (
    <dialog
      ref={dialogRef}
      id="site-sidebar"
      className="sidebar"
      aria-labelledby="sidebar-title"
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        // Native dialog modality alone can allow the browser chrome into the Tab cycle.
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sidebar-content">
        <div className="sidebar-top">
          <h2 id="sidebar-title">Explore the ledger</h2>
          <IconButton
            ref={closeRef}
            icon="close"
            label="Close navigation"
            variant="subtle"
            onClick={onClose}
          />
        </div>
        <nav className="sidebar-nav" aria-label="Mobile navigation">
          {navigationLinks.map((link) => (
            <Link key={link.to} to={link.to} onClick={onClose}>
              {link.label}
            </Link>
          ))}
        </nav>
        <ButtonLink to="/#get-started" state={{ entry: 'create' }} onClick={onClose}>
          Create an account
        </ButtonLink>
        <p className="sidebar-note">
          A simple ledger demo.
          <br />
          Clear entries. One source of truth.
        </p>
      </div>
    </dialog>
  );
}
