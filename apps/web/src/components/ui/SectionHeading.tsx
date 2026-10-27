/** Consistent section heading hierarchy and optional explanatory copy. */
import type { ReactNode } from 'react';
import styles from './ui.module.css';
/** Presents a semantic h2 or h3 without duplicating section typography in pages. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  as: Heading = 'h2',
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  as?: 'h2' | 'h3';
}) {
  return (
    <div className={styles.heading}>
      {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
      <Heading>{title}</Heading>
      {description && <p className={styles.description}>{description}</p>}
    </div>
  );
}
