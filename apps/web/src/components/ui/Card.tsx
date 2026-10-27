/** Shared card boundary and spacing; card consumers retain their own semantic headings. */
import type { HTMLAttributes } from 'react';
import styles from './ui.module.css';
/** Groups related content using the shared default or soft surface variant. */
export function Card({
  variant = 'default',
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'soft' }) {
  return (
    <div
      {...props}
      className={`${styles.card} ${variant === 'soft' ? styles.soft : ''} ${className}`}
    />
  );
}
