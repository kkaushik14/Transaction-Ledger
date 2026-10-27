/** Shared footer with real navigation and accurate demo context instead of placeholder links. */
import { Link } from 'react-router-dom';
import { Container } from '../ui/Container';
import { Icon } from '../ui/Icon';
import { navigationLinks } from './navigation';
/** Keeps product identity and recovery navigation available on every route. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Container>
        <div className="footer-top">
          <div>
            <Link className="site-logo" to="/">
              <span className="logo-mark">
                <Icon name="ledger" />
              </span>
              Transaction Ledger
            </Link>
            <p className="footer-copy">
              A clear record of what comes in,
              <br />
              what goes out, and what remains.
            </p>
          </div>
          <nav className="footer-nav" aria-label="Footer navigation">
            {navigationLinks.map((link) => (
              <Link key={link.to} to={link.to}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="footer-bottom">
          <span>Transaction Ledger · Demo application</span>
          <span>Made for clarity. Built around consistency.</span>
        </div>
      </Container>
    </footer>
  );
}
