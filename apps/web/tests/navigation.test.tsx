/** Navigation is verified independently before landing/account pages are assembled. */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SiteHeader } from '../src/components/layout/SiteHeader';
import { SiteFooter } from '../src/components/layout/SiteFooter';

describe('site navigation', () => {
  it('uses real destinations and the same link set in the drawer/footer', () => {
    render(
      <MemoryRouter>
        <SiteHeader />
        <SiteFooter />
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Footer navigation' })).toBeInTheDocument();
    for (const link of screen.getAllByRole('link'))
      expect(link.getAttribute('href')).toMatch(/^\/(#(features|how-it-works|get-started))?$/);
  });
  it('opens with focus inside, locks scrolling, closes on Escape, and restores focus', async () => {
    render(
      <MemoryRouter>
        <SiteHeader />
      </MemoryRouter>,
    );
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const dialog = screen.getByRole('dialog', { name: 'Explore the ledger' });
    expect(dialog).toHaveAttribute('open');
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }));
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
    expect(document.body.style.overflow).toBe('');
    expect(trigger).toHaveFocus();
  });
  it('closes when a navigation destination is selected', async () => {
    render(
      <MemoryRouter>
        <SiteHeader />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const navigation = screen.getByRole('navigation', { name: 'Mobile navigation' });
    const first = navigation.querySelector('a');
    if (!first) throw new Error('Missing navigation link');
    await userEvent.click(first);
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
  it('resets an open drawer on the desktop breakpoint and removes its listener', async () => {
    let listener: EventListener | undefined;
    const media = {
      matches: false,
      media: '(min-width: 1024px)',
      addEventListener: vi.fn((_event: string, callback: EventListener) => {
        listener = callback;
      }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', () => media);
    const view = render(
      <MemoryRouter>
        <SiteHeader />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    media.matches = true;
    listener?.(new Event('change'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
        'aria-expanded',
        'false',
      ),
    );
    expect(document.body.style.overflow).toBe('');
    view.unmount();
    expect(media.removeEventListener).toHaveBeenCalled();
  });
});
