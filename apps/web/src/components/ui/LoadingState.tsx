/** Accessible progress message; its decorative spinner respects reduced-motion preferences. */
import styles from './ui.module.css';
/** Gives asynchronous reads a visible and screen-reader friendly loading state. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className={styles.loading} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      {label}
    </div>
  );
}
