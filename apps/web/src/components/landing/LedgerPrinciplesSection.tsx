/** Explains tested integrity properties without implying real banking or unsupported security guarantees. */
import { Container, Icon, type IconName } from '../ui/index.js';

import styles from './landing.module.css';
const principles: { icon: IconName; title: string; copy: string }[] = [
  {
    icon: 'shield',
    title: 'All or nothing',
    copy: 'Your balance and entry are saved together. If either step fails, neither change is kept.',
  },
  {
    icon: 'check',
    title: 'One intent. One entry.',
    copy: 'Account-scoped references prevent the same request from moving money twice.',
  },
  {
    icon: 'ledger',
    title: 'A record that stays put',
    copy: 'Accepted transactions cannot be edited or deleted through the API. Your history keeps its meaning.',
  },
];
/** Inverts the same monochrome tokens to give the principles section clear visual hierarchy. */
export function LedgerPrinciplesSection() {
  return (
    <section className={`section ${styles.principles}`} aria-labelledby="principles-title">
      <Container>
        <p className={styles.eyebrow}>Consistency at the core</p>
        <h2 id="principles-title" style={{ marginTop: 'var(--space-4)' }}>
          Built around a few things
          <br />
          that should never change.
        </h2>
        <div className={`${styles.principlesGrid} landing-principles-grid`}>
          {principles.map((item) => (
            <div key={item.title} className={styles.principle}>
              <Icon name={item.icon} />
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
