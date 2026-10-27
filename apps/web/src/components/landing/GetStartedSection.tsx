/** Working account entry composes independently tested create/lookup forms. */
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/SectionHeading';
import { Card } from '../ui/Card';
import { AccountCreateForm } from '../../features/accounts/components/AccountCreateForm';
import { AccountLookupForm } from '../../features/accounts/components/AccountLookupForm';
import styles from './landing.module.css';
/** Provides the actual destinations for hero, navigation, footer, and final CTAs. */
export function GetStartedSection() {
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
            description="Create a fresh account or open your existing one. The next entry is yours."
          />
        </div>
        <div className={`${styles.entryGrid} landing-entry-grid`}>
          <Card className={`${styles.entryCard} entry-form-card`}>
            <AccountCreateForm />
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
