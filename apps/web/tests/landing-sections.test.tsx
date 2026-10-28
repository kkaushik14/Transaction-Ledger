/** Each landing section is checked independently before HomePage is composed. */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import {
  HeroSection,
  FeatureGrid,
  HowItWorksSection,
  LedgerPrinciplesSection,
  GetStartedSection,
  FinalCtaSection,
} from '../src/components/landing/index.js';

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
