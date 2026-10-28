/** Reusable labeled multiline field; descriptions and errors remain screen-reader associated. */
import { useId, type ComponentPropsWithRef } from 'react';
import styles from './ui.module.css';
/** Renders a native textarea with consistent label, hint, and validation semantics. */
export function TextAreaField({
  label,
  hint,
  error,
  id,
  className = '',
  ...props
}: ComponentPropsWithRef<'textarea'> & {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
}) {
  const generated = useId();
  const controlId = id ?? generated;
  const described =
    [
      props['aria-describedby'],
      hint ? `${controlId}-hint` : null,
      error ? `${controlId}-error` : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={controlId}>
        {label}
      </label>
      <textarea
        {...props}
        id={controlId}
        className={`${styles.control} ${styles.textarea} ${className}`}
        aria-describedby={described}
        aria-invalid={Boolean(error) || props['aria-invalid'] || undefined}
      />
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
