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
  tone?: 'info' | 'success' | 'error';
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`${styles.status} ${tone === 'error' ? styles.errorStatus : ''}`}
    >
      <Icon name={tone === 'success' ? 'check' : tone === 'error' ? 'alert' : 'ledger'} />
      <div>
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}
