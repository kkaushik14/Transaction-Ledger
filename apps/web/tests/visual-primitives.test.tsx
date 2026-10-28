/** Visual contracts are checked independently before landing/workspace composition. */
import { act, render, screen, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type * as Three from 'three';
const state = vi.hoisted(() => ({
  reduced: false,
  frame: undefined as undefined | ((time: number, delta: number) => void),
  render: vi.fn(),
  dispose: vi.fn(),
}));
vi.mock('motion/react', () => ({
  useReducedMotion: () => state.reduced,
  useAnimationFrame: (callback: (time: number, delta: number) => void) => {
    state.frame = callback;
  },
}));
vi.mock('three', async () => ({
  ...(await vi.importActual<typeof Three>('three')),
  WebGLRenderer: class {
    setClearColor() {}
    setPixelRatio() {}
    setSize() {}
    render = state.render;
    dispose = state.dispose;
  },
}));
import { BackgroundCubesGrid } from '../src/components/ui/cubes/index.js';
import { Skeleton, Spinner, TypewriterText } from '../src/components/ui/index.js';
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  state.reduced = false;
  state.render.mockReset();
  state.dispose.mockReset();
});
describe('v0.3 independent visual primitives', () => {
  it('provides one immediately accessible H1 and completes its reveal once without moving the reserved copy', () => {
    vi.useFakeTimers();
    const { container, rerender, unmount } = render(
      <TypewriterText text="A clear view of every transaction." breakAt={15} />,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'A clear view of every transaction.' }),
    ).toBeInTheDocument();
    expect(container.querySelector('[data-reveal-complete]')).toHaveTextContent('');
    act(() => vi.advanceTimersByTime(45));
    expect(container.querySelector('[data-reveal-complete]')).toHaveTextContent('A');
    act(() => vi.advanceTimersByTime(2000));
    expect(container.querySelector('[data-reveal-complete]')).toHaveAttribute(
      'data-reveal-complete',
      'true',
    );
    rerender(<TypewriterText text="A clear view of every transaction." breakAt={15} />);
    expect(container.querySelector('[data-reveal-complete]')).toHaveAttribute(
      'data-reveal-complete',
      'true',
    );
    expect(vi.getTimerCount()).toBe(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('shows the full static heading for reduced motion and cleans up an interrupted reveal', () => {
    vi.useFakeTimers();
    state.reduced = true;
    const first = render(<TypewriterText text="Full heading" />);
    expect(first.container.querySelector('[data-reveal-complete]')).toHaveTextContent(
      'Full heading',
    );
    expect(vi.getTimerCount()).toBe(0);
    first.unmount();
    state.reduced = false;
    const second = render(<TypewriterText text="Full heading" />);
    expect(vi.getTimerCount()).toBe(1);
    second.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('keeps a completed static heading when reduced motion is turned off', async () => {
    state.reduced = true;
    const { container, rerender } = render(<TypewriterText text="Full heading" />);
    await act(async () => {});
    state.reduced = false;
    rerender(<TypewriterText text="Full heading" />);
    expect(container.querySelector('[data-reveal-complete]')).toHaveTextContent('Full heading');
    expect(container.querySelector('[data-reveal-complete]')).toHaveAttribute(
      'data-reveal-complete',
      'true',
    );
  });
  it('contains timer setup failure with full static copy and private diagnostics', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const timer = vi.spyOn(window, 'setInterval').mockImplementation(() => {
      throw new Error('timer unavailable');
    });
    const { container } = render(<TypewriterText text="Full heading" />);
    timer.mockRestore();
    await waitFor(() =>
      expect(container.querySelector('[data-reveal-complete]')).toHaveTextContent('Full heading'),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('announces one busy status for each skeleton with decorative shapes and no fake numbers', () => {
    render(
      <>
        <Skeleton variant="balance" />
        <Skeleton variant="history" />
        <Spinner />
      </>,
    );
    expect(screen.getAllByRole('status')).toHaveLength(2);
    expect(screen.getByText('Loading account balance…')).toBeInTheDocument();
    for (const status of screen.getAllByRole('status')) {
      expect(status).toHaveAttribute('aria-busy', 'true');
      expect(status).not.toHaveTextContent(/\d/);
    }
  });
  it('contains graphics frame errors, reports once and disposes observers/GPU on unmount', () => {
    const disconnect = vi.fn(),
      fallback = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect = disconnect;
      },
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container, unmount } = render(<BackgroundCubesGrid onUnavailable={fallback} />);
    state.render.mockImplementation(() => {
      throw new Error('private graphics failure');
    });
    act(() => state.frame?.(1, 16));
    act(() => state.frame?.(2, 16));
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(container.querySelector('canvas')).toHaveStyle({ visibility: 'hidden' });
    unmount();
    expect(state.dispose).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
  it('pauses simulation outside the viewport or hidden document and releases the visibility observer', () => {
    let visibility: (entries: { isIntersecting: boolean }[]) => void = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: typeof visibility) {
          visibility = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const view = render(<BackgroundCubesGrid idleRipples={false} />);
    visibility([{ isIntersecting: false }]);
    act(() => state.frame?.(1, 16));
    expect(state.render).not.toHaveBeenCalled();
    visibility([{ isIntersecting: true }]);
    act(() => state.frame?.(2, 16));
    expect(state.render).toHaveBeenCalledTimes(1);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => state.frame?.(3, 16));
    expect(state.render).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
  it('uses the same local fallback on context loss and avoids GPU setup for reduced motion', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fallback = vi.fn();
    const mounted = render(<BackgroundCubesGrid onUnavailable={fallback} />);
    act(() =>
      mounted.container
        .querySelector('canvas')
        ?.dispatchEvent(new Event('webglcontextlost', { cancelable: true })),
    );
    expect(fallback).toHaveBeenCalledTimes(1);
    mounted.unmount();
    state.reduced = true;
    const staticGrid = render(<BackgroundCubesGrid />);
    act(() => state.frame?.(1, 16));
    staticGrid.unmount();
    expect(state.dispose).toHaveBeenCalledTimes(1);
  });
});
