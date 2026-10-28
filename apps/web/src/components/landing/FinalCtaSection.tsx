/** Final CTA returns to real account-entry controls instead of a placeholder destination. */
import { Container, ButtonLink, Icon } from '../ui/index.js';

import styles from './landing.module.css';
/** Completes the landing page with a concise actionable next step. */
export function FinalCtaSection() {
  return (
    <section className="section" aria-labelledby="final-cta-title">
      <Container className={styles.finalCta}>
        <div>
          <h2 id="final-cta-title">Ready for your first entry?</h2>
          <p>Start with a clean balance. Build a clear record.</p>
        </div>
        <ButtonLink to="/#get-started" state={{ entry: 'create' }}>
          Create an account
          <Icon name="arrow" />
        </ButtonLink>
      </Container>
    </section>
  );
}
