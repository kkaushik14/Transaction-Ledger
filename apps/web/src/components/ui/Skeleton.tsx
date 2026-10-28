/** Shape-matched initial-read placeholders contain no invented financial values. */
import styles from './ui.module.css';
export interface SkeletonProps {
  variant: 'balance' | 'history';
  label?: string;
}
/** Mirrors missing balance/history content while the owning request is pending. */
export function Skeleton({
  variant,
  label = variant === 'balance' ? 'Loading account balance…' : 'Loading transaction history…',
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={variant === 'balance' ? styles.balanceSkeleton : styles.historySkeleton}
    >
      <span className="sr-only">{label}</span>
      {variant === 'balance' ? (
        <div aria-hidden="true" className={styles.skeletonStack}>
          <span className={`${styles.skeleton} ${styles.skeletonLabel}`} />
          <span className={`${styles.skeleton} ${styles.skeletonAmount}`} />
          <span className={`${styles.skeleton} ${styles.skeletonFoot}`} />
        </div>
      ) : (
        <div aria-hidden="true">
          <div className="history-table">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={styles.skeletonRow}>
                {Array.from({ length: 4 }, (_, j) => (
                  <span key={j} className={styles.skeleton} />
                ))}
              </div>
            ))}
          </div>
          <div className="history-cards">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className={styles.skeletonMobile}>
                <span className={`${styles.skeleton} ${styles.skeletonLabel}`} />
                <span className={styles.skeleton} />
                <span className={styles.skeleton} />
                <span className={styles.skeleton} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
