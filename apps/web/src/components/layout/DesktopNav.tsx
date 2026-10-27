/** Horizontal navigation shares the same real destinations as the responsive drawer. */
import { Link } from 'react-router-dom';
import { navigationLinks } from './navigation';
/** CSS exposes this navigation only at the desktop breakpoint. */
export function DesktopNav() {
  return (
    <nav className="desktop-nav" aria-label="Main navigation">
      {navigationLinks.map((link) => (
        <Link key={link.to} to={link.to}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
