/** Capability cards describe only the four implemented backend workflows. */
import { Container, SectionHeading, Card, Icon, type IconName } from '../ui/index.js';

import styles from './landing.module.css';
const features: { icon: IconName; title: string; copy: string }[] = [
  {
    icon: 'plus',
    title: 'Start from zero',
    copy: 'Create a named account with its own ID and a clean starting balance.',
  },
  {
    icon: 'arrow',
    title: 'Record every movement',
    copy: 'Add credits and debits with descriptions. Never spend beyond the available balance.',
  },
  {
    icon: 'ledger',
    title: 'Know your balance',
    copy: 'See an authoritative balance that stays in sync with accepted ledger entries.',
  },
  {
    icon: 'clock',
    title: 'Review your history',
    copy: 'Browse your latest entries, filter credits or debits, and move through every page.',
  },
];
/** Reuses Card rather than creating a second landing-only control language. */
export function FeatureGrid() {
  return (
    <section
      id="features"
      tabIndex={-1}
      className="section section-soft"
      aria-labelledby="features-title"
    >
      <Container>
        <div className="section-head">
          <SectionHeading
            eyebrow="Everything in order"
            title="Simple by design. Complete where it counts."
            description="The essentials of a ledger, with nothing between you and your records."
          />
        </div>
        <span id="features-title" className="sr-only">
          Ledger features
        </span>
        <div className={`${styles.featureGrid} landing-feature-grid`}>
          {features.map((feature) => (
            <Card key={feature.title} className={styles.featureCard}>
              <span className={styles.featureIcon}>
                <Icon name={feature.icon} />
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
