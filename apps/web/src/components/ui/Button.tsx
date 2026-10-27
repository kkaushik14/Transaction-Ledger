/** Shared native buttons and navigation links with consistent monochrome variants. */
import type { ComponentPropsWithRef, ComponentProps } from 'react';
import { Link } from 'react-router-dom';
import styles from './ui.module.css';
/** Intent/visual hierarchy shared by button and link controls. */
export type ButtonVariant = 'primary' | 'secondary' | 'subtle';
/** Native button props plus explicit asynchronous state. */
export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  loading?: boolean;
}
/** Prevents repeated activation while loading, preserving native button semantics. */
export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${styles.button} ${styles[variant]} ${className}`}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  );
}
/** Uses real router navigation semantics for a CTA that changes location. */
export function ButtonLink({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link {...props} className={`${styles.button} ${styles[variant]} ${className}`} />;
}
