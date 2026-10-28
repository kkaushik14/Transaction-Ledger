/** Decorative pending indicator. The owning control/status supplies its accessible label. */
import styles from './ui.module.css';
/** Renders a purely decorative indicator; its parent announces pending work. */
export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`${styles.spinner} ${className}`} aria-hidden="true" />;
}
