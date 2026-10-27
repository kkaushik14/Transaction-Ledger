/** Labeled native select preserving keyboard, touch, and form accessibility behavior. */
import { useId, type ComponentPropsWithRef } from 'react';
import styles from './ui.module.css';
/** Renders consumer-owned options with consistent field labeling and error feedback. */
export function SelectField({
  label,
  hint,
  error,
  id,
  className = '',
  children,
  ...props
}: ComponentPropsWithRef<'select'> & {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
}) {
  const generated = useId();
  const controlId = id ?? generated;
  const described =
    [hint ? `${controlId}-hint` : null, error ? `${controlId}-error` : null]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={controlId}>
        {label}
      </label>
      <select
        {...props}
        id={controlId}
        className={`${styles.control} ${className}`}
        aria-describedby={described}
        aria-invalid={Boolean(error) || undefined}
      >
        {children}
      </select>
      {hint && (
        <p className={styles.hint} id={`${controlId}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className={styles.error} id={`${controlId}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
