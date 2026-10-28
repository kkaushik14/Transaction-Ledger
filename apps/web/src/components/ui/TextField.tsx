/** Labeled native text input with associated hint/error text and React ref support. */
import { useId, type ComponentPropsWithRef } from 'react';
import styles from './ui.module.css';
/** Reusable input API; callers provide labels and optional field-specific feedback. */
export type TextFieldProps = ComponentPropsWithRef<'input'> & {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
};
/** Associates all descriptions with the input without relying on placeholder labels. */
export function TextField({ label, hint, error, id, className = '', ...props }: TextFieldProps) {
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
      <input
        {...props}
        id={controlId}
        className={`${styles.control} ${className}`}
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
