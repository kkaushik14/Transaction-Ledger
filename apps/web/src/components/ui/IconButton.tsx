/** Accessible, touch-sized icon-only button built on the shared Button primitive. */
import { Button, type ButtonProps } from './Button';
import { Icon, type IconName } from './Icon';
import styles from './ui.module.css';
/** Requires a human-readable label; decorative icon names are not accessible labels. */
export function IconButton({
  label,
  icon,
  className = '',
  ...props
}: Omit<ButtonProps, 'children'> & { label: string; icon: IconName }) {
  return (
    <Button
      {...props}
      className={`${styles.iconButton} ${className}`}
      aria-label={label}
      title={label}
    >
      <Icon name={icon} />
    </Button>
  );
}
