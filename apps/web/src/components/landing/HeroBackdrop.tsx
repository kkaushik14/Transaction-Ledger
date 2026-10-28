/** Hero-local decorative enhancement; unsupported or failed graphics leave a static neutral surface. */
import {
  Component,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react';
import { useReducedMotion } from 'motion/react';
import { reportError } from '../../errors/index.js';
import { BackgroundCubesGrid } from '../ui/index.js';
import styles from './landing.module.css';
/** Mounts reference graphics only while a desktop mouse hovers over the hero; fallback never blocks financial controls. */
export function HeroBackdrop({ hoverTarget }: { hoverTarget: RefObject<HTMLElement | null> }) {
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const desktopMouse = useSyncExternalStore(subscribeDesktopMouse, isDesktopMouse, () => false);
  useEffect(() => {
    const target = hoverTarget.current;
    if (!target) return;
    const enter = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') setHovered(true);
    };
    const leave = () => setHovered(false);
    target.addEventListener('pointerenter', enter);
    target.addEventListener('pointerleave', leave);
    target.addEventListener('pointercancel', leave);
    window.addEventListener('blur', leave);
    return () => {
      target.removeEventListener('pointerenter', enter);
      target.removeEventListener('pointerleave', leave);
      target.removeEventListener('pointercancel', leave);
      window.removeEventListener('blur', leave);
    };
  }, [hoverTarget]);
  const unavailable = useCallback(() => setFailed(true), []);
  const limited = navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 2;
  const supported =
    typeof window.WebGL2RenderingContext !== 'undefined' && typeof ResizeObserver !== 'undefined';
  const eligible = desktopMouse && supported && !reduced && !limited && !failed;
  const animated = eligible && hovered;
  return (
    <div
      aria-hidden="true"
      className={styles.heroBackdrop}
      data-hero-backdrop={animated ? 'animated' : 'static'}
      data-hero-cubes-enabled={eligible}
    >
      {animated && (
        <GraphicsBoundary onUnavailable={unavailable}>
          <BackgroundCubesGrid
            variant="isometric"
            idleRipples={false}
            topColor="#fafafa"
            leftColor="#e5e5e5"
            rightColor="#d4d4d4"
            glowColor="#737373"
            onUnavailable={unavailable}
          />
        </GraphicsBoundary>
      )}
    </div>
  );
}

/** Import/render failures affect decoration only; the static surface remains behind usable content. */
class GraphicsBoundary extends Component<
  { children: ReactNode; onUnavailable: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    reportError(error, 'hero.graphics.load');
    this.props.onUnavailable();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Matches the established desktop breakpoint and a genuine mouse/hover input device. */
function isDesktopMouse(): boolean {
  return window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)').matches;
}
/** Reevaluate capability on resize/input changes without leaving a graphics instance on mobile. */
function subscribeDesktopMouse(onChange: () => void): () => void {
  const media = window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)');
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
