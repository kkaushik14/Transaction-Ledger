/** Each landing section is checked independently before HomePage is composed. */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { HeroSection } from '../src/components/landing/HeroSection';
import { FeatureGrid } from '../src/components/landing/FeatureGrid';
import { HowItWorksSection } from '../src/components/landing/HowItWorksSection';
import { LedgerPrinciplesSection } from '../src/components/landing/LedgerPrinciplesSection';
import { GetStartedSection } from '../src/components/landing/GetStartedSection';
import { FinalCtaSection } from '../src/components/landing/FinalCtaSection';

describe('landing sections', () => {
  it('has a clear hero heading, real CTAs, and an honest illustrative preview', () => {
    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'A clear view of every transaction.',
    );
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/#get-started',
    );
    expect(screen.getByRole('link', { name: 'Open an account' })).toHaveAttribute(
      'href',
      '/#get-started',
    );
    expect(screen.getByText(/Example only/)).toBeInTheDocument();
  });
  it('describes only supported ledger capabilities in a shared card system', () => {
    render(<FeatureGrid />);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4);
    expect(document.getElementById('features')).toBeInTheDocument();
  });
  it('explains the three-step flow and actual integrity behavior', () => {
    render(
      <>
        <HowItWorksSection />
        <LedgerPrinciplesSection />
      </>,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('All or nothing')).toBeInTheDocument();
  });
  it('composes both usable account forms at the get-started anchor', () => {
    render(
      <MemoryRouter>
        <GetStartedSection />
        <FinalCtaSection />
      </MemoryRouter>,
    );
    expect(document.getElementById('get-started')).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Create an account' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Open an account' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/#get-started',
    );
  });
});
