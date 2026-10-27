/** Shared fluid content-width boundary with consistent mobile gutters. */
import type { HTMLAttributes } from 'react';
import styles from './ui.module.css';
/** Constrains content without fixed-width elements that overflow small viewports. */
export function Container({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`${styles.container} ${className}`} />;
}
