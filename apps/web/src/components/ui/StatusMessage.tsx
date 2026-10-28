/** Monochrome semantic feedback; text and iconography carry meaning independently of color. */
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './ui.module.css';
/** Announces errors assertively and normal outcomes politely, without stealing focus. */
export function StatusMessage({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'success';
  title?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" className={styles.status}>
      <Icon name={tone === 'success' ? 'check' : 'ledger'} />
      <div>
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}
