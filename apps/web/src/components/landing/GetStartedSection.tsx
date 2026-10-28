/** Working account entry composes independently tested create/lookup forms. */
import { Container, SectionHeading, Card } from '../ui/index.js';

import {
  AccountCreateForm,
  AccountLookupForm,
  useActiveAccount,
  ActiveAccountCard,
} from '../../features/accounts/index.js';

import styles from './landing.module.css';
/** Provides the actual destinations for hero, navigation, footer, and final CTAs. */
export function GetStartedSection() {
  const active = useActiveAccount()?.account;
  return (
    <section
      id="get-started"
      tabIndex={-1}
      className="section section-soft"
      aria-label="Get started"
    >
      <Container>
        <div className="section-head">
          <SectionHeading
            eyebrow="Your next step"
            title="Your ledger starts here."
            description={
              active
                ? 'Return to your selected account or open another using its Account ID.'
                : 'Create a fresh account or open your existing one. The next entry is yours.'
            }
          />
        </div>
        <div className={`${styles.entryGrid} landing-entry-grid`}>
          <Card className={`${styles.entryCard} entry-form-card`}>
            {active ? <ActiveAccountCard account={active} /> : <AccountCreateForm />}
          </Card>
          <Card className={`${styles.entryCard} entry-form-card`}>
            <AccountLookupForm />
          </Card>
        </div>
        <p className={styles.entryNote}>
          Demo application · Amounts use a single abstract unit. No real payment processing.
        </p>
      </Container>
    </section>
  );
}
