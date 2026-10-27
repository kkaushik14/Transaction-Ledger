/** Shared destinations prevent desktop, drawer, and footer navigation from drifting. */
export const navigationLinks = [
  { label: 'Overview', to: '/' },
  { label: 'Features', to: '/#features' },
  { label: 'How it works', to: '/#how-it-works' },
  { label: 'Get started', to: '/#get-started' },
] as const;
/** Reads the CSS breakpoint token used by the responsive layout stylesheet. */
export function desktopMediaQuery(): string {
  const width =
    getComputedStyle(document.documentElement).getPropertyValue('--breakpoint-desktop').trim() ||
    '1024px';
  return `(min-width: ${width})`;
}
