/** Landing page assembles completed sections; no control styling, HTTP calls, or domain state lives here. */
import { HeroSection } from '../components/landing/HeroSection';
import { FeatureGrid } from '../components/landing/FeatureGrid';
import { HowItWorksSection } from '../components/landing/HowItWorksSection';
import { LedgerPrinciplesSection } from '../components/landing/LedgerPrinciplesSection';
import { GetStartedSection } from '../components/landing/GetStartedSection';
import { FinalCtaSection } from '../components/landing/FinalCtaSection';
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
