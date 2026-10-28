/** Accessible progress message; its decorative spinner respects reduced-motion preferences. */
import styles from './ui.module.css';
import { Spinner } from './Spinner.js';
/** Gives asynchronous reads a visible and screen-reader friendly loading state. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className={styles.loading} role="status">
      <Spinner />
      {label}
    </div>
  );
}
