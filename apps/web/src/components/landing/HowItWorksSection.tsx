/** Three practical steps explain the implemented account/transaction/history workflow. */
import { Container, SectionHeading } from '../ui/index.js';

import styles from './landing.module.css';
const steps = [
  {
    title: 'Create your account',
    copy: 'Give it a name and keep your account ID. Already have one? Open it with its UUID.',
  },
  {
    title: 'Make your first entry',
    copy: 'Choose credit or debit, enter an amount, and add a note. The ledger handles the rest.',
  },
  {
    title: 'See the full picture',
    copy: 'Check your balance and browse your history. Each accepted entry remains part of the record.',
  },
];
/** Uses a semantic ordered list for the sequence rather than decorative numbered blocks. */
export function HowItWorksSection() {
  return (
    <section id="how-it-works" tabIndex={-1} className="section" aria-label="How it works">
      <Container>
        <div className="section-head">
          <SectionHeading
            eyebrow="How it works"
            title="From your first account to your next entry."
            description="Three straightforward steps. One clear record."
          />
        </div>
        <ol
          className={`${styles.stepsGrid} landing-steps-grid`}
          style={{ listStyle: 'none', padding: 0, margin: 0 }}
        >
          {steps.map((step, index) => (
            <li className={styles.step} key={step.title}>
              <span className={styles.stepNumber}>0{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
