/** Final CTA returns to real account-entry controls instead of a placeholder destination. */
import { Container, ButtonLink, Icon } from '../ui/index.js';

import { useActiveAccount } from '../../features/accounts/index.js';
import styles from './landing.module.css';
/** Completes the landing page with a concise actionable next step. */
export function FinalCtaSection() {
  const active = useActiveAccount()?.account;
  return (
    <section className="section" aria-labelledby="final-cta-title">
      <Container className={styles.finalCta}>
        <div>
          <h2 id="final-cta-title">
            {active ? 'Ready for your next entry?' : 'Ready for your first entry?'}
          </h2>
          <p>
            {active
              ? 'Return to your account and keep your record up to date.'
              : 'Start with a clean balance. Build a clear record.'}
          </p>
        </div>
        <ButtonLink
          to={active ? `/accounts/${active.id}` : '/#get-started'}
          state={active ? undefined : { entry: 'create' }}
        >
          {active ? 'My account' : 'Create an account'}
          <Icon name="arrow" />
        </ButtonLink>
      </Container>
    </section>
  );
}
