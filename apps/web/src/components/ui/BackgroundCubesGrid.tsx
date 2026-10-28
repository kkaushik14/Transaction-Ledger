/** Keeps optional Three.js code out of the application entry bundle and non-hero routes. */
import { lazy, Suspense } from 'react';
import type { BackgroundCubesGridProps } from './cubes/index.js';
const CubeSurface = lazy(() =>
  import('./cubes/index.js').then((module) => ({ default: module.BackgroundCubesGrid })),
);
/** Owners provide a local error boundary; the existing static surface remains during module loading. */
export function BackgroundCubesGrid(props: BackgroundCubesGridProps) {
  return (
    <Suspense fallback={null}>
      <CubeSurface {...props} />
    </Suspense>
  );
}
export type {
  BackgroundCubesGridProps,
  IsometricCubesProps,
  PerspectiveCubesProps,
} from './cubes/index.js';
