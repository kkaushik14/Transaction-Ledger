/** Combines conditional classes while allowing callers to override utility defaults. */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
/** Merges caller overrides without copying conditional utility logic into visual consumers. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
