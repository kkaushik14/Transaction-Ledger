/** Small code-native monochrome icons shared by controls and feature feedback. */
import type { SVGProps } from 'react';
import styles from './ui.module.css';
const paths = {
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'm5 12 4 4L19 6',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  alert: 'M12 8v5m0 3h.01M12 3 2 21h20z',
  ledger: 'M5 3h14v18H5zM9 7h6M9 11h6M9 15h3',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6',
  clock: 'M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  chevronLeft: 'm14 6-6 6 6 6',
  chevronRight: 'm10 6 6 6-6 6',
};
/** Icon identifier constrained to the local visual vocabulary. */
export type IconName = keyof typeof paths;
/** Renders a decorative icon; its containing control supplies any accessible name. */
export function Icon({
  name,
  className = '',
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      {...props}
      className={`${styles.icon} ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
