/** Landing value proposition and working entry CTAs; preview figures are explicitly illustrative. */
import { useRef } from 'react';
import { Container, Card, ButtonLink, Icon, TypewriterText } from '../ui/index.js';

import { useActiveAccount } from '../../features/accounts/index.js';
import styles from './landing.module.css';
import { HeroBackdrop } from './HeroBackdrop.js';
/** Presents actual ledger capabilities without inventing live accounts, metrics, or payment integrations. */
export function HeroSection() {
  const hero = useRef<HTMLElement>(null);
  const active = useActiveAccount()?.account;
  return (
    <section ref={hero} className={styles.hero} aria-labelledby="hero-title">
      <HeroBackdrop hoverTarget={hero} />
      <Container>
        <div className={`${styles.heroGrid} landing-hero-grid`}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              <span className={styles.dot} />
              Clarity, entry by entry
            </p>
            <TypewriterText
              id="hero-title"
              text="A clear view of every transaction."
              breakAt={15}
            />
            <p className={styles.heroDescription}>
              Money in. Money out. Every entry in its place. A simple ledger to record movements and
              always know where you stand.
            </p>
            <div className="inline-actions hero-actions">
              <ButtonLink
                to={active ? `/accounts/${active.id}` : '/#get-started'}
                state={active ? undefined : { entry: 'create' }}
              >
                {active ? 'My account' : 'Create an account'}
                <Icon name="arrow" />
              </ButtonLink>
              <ButtonLink to="/#get-started" state={{ entry: 'lookup' }} variant="secondary">
                Open an account
              </ButtonLink>
            </div>
            <p className={styles.heroNote}>
              <span>
                <Icon name="check" />
                No sign-up
              </span>
              <span>
                <Icon name="check" />
                Start with a zero balance
              </span>
            </p>
          </div>
          <figure className={styles.preview}>
            <Card className={styles.previewCard}>
              <div className={styles.previewTop}>
                <span className={styles.previewMark}>
                  <Icon name="ledger" />
                  Account preview
                </span>
                <span className={styles.previewLabel}>Illustrative</span>
              </div>
              <div className={styles.previewBalance}>
                <p>Current balance</p>
                <strong className={styles.previewAmount}>150.00</strong>
                <span className={styles.previewCaption}>
                  <Icon name="check" />
                  Every entry accounted for
                </span>
              </div>
              <div className={styles.previewRows}>
                <div className={styles.previewRow}>
                  <div>
                    <span className={styles.entryIcon}>
                      <Icon name="plus" />
                    </span>
                    <span>
                      Opening credit<small>Credit · Example entry</small>
                    </span>
                  </div>
                  <strong>+200.00</strong>
                </div>
                <div className={styles.previewRow}>
                  <div>
                    <span className={styles.entryIcon}>
                      <Icon name="minus" />
                    </span>
                    <span>
                      Recorded debit<small>Debit · Example entry</small>
                    </span>
                  </div>
                  <strong>−50.00</strong>
                </div>
              </div>
              <div className={styles.previewFoot}>
                <Icon name="shield" />
                Two entries. One consistent balance.
              </div>
            </Card>
            <figcaption className={styles.figureCaption}>
              Example only. Open an account for your live ledger.
            </figcaption>
          </figure>
        </div>
        <div className={styles.heroStrip}>
          <span>
            <Icon name="ledger" />A permanent record
          </span>
          <span>
            <Icon name="shield" />
            Protected against duplicate entries
          </span>
          <span>
            <Icon name="clock" />
            Your latest movements, first
          </span>
        </div>
      </Container>
    </section>
  );
}
