/** Generic server-metadata pagination, independent of ledger filtering or data fetching. */
import { Button } from './Button';
import { Icon } from './Icon';
import styles from './ui.module.css';
/** Uses metadata boundaries to prevent invalid or repeated in-flight page requests. */
export function Pagination({
  page,
  totalPages,
  totalRecords,
  loading = false,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalRecords: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav aria-label="Transaction pagination" className={styles.pagination}>
      <p className={styles.pageInfo}>
        {totalRecords} {totalRecords === 1 ? 'transaction' : 'transactions'}
        {totalPages > 0 && (
          <>
            {' '}
            · Page {page} of {totalPages}
          </>
        )}
      </p>
      <div className={styles.pageControls}>
        <Button
          variant="secondary"
          disabled={loading || page <= 1 || totalPages === 0}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <Icon name="chevronLeft" />
          Previous
        </Button>
        <Button
          variant="secondary"
          disabled={loading || page >= totalPages || totalPages === 0}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
          <Icon name="chevronRight" />
        </Button>
      </div>
    </nav>
  );
}
