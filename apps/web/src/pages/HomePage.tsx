/** Landing page assembles completed sections; no control styling, HTTP calls, or domain state lives here. */
import {
  HeroSection,
  FeatureGrid,
  HowItWorksSection,
  LedgerPrinciplesSection,
  GetStartedSection,
  FinalCtaSection,
} from '../components/landing/index.js';

/** Presents the approved v0.2 section order without duplicating feature implementation. */
export function HomePage() {
  return (
    <>
      <HeroSection />
      <FeatureGrid />
      <HowItWorksSection />
      <LedgerPrinciplesSection />
      <GetStartedSection />
      <FinalCtaSection />
    </>
  );
}
