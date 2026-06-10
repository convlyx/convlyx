"use client";

import { useState } from "react";
import { SiteFooter } from "./site-footer";
import { DemoDialog } from "./demo-dialog";
import { LandingNav } from "./landing/landing-nav";
import { LandingHero } from "./landing/landing-hero";
import { TrustStrip } from "./landing/trust-strip";
import { ProblemSolution } from "./landing/problem-solution";
import { FeaturesBento } from "./landing/features-bento";
import { ProductShowcase } from "./landing/product-showcase";
import { RolesSection } from "./landing/roles-section";
import { HowItWorks } from "./landing/how-it-works";
import { SecuritySection } from "./landing/security-section";
import { FaqSection } from "./landing/faq-section";
import { FinalCta } from "./landing/final-cta";

export function LandingPage() {
  const [demoOpen, setDemoOpen] = useState(false);
  const openDemo = () => setDemoOpen(true);

  return (
    <div className="landing-scope min-h-screen overflow-hidden">
      <LandingNav onRequestDemo={openDemo} />
      <main>
        <LandingHero onRequestDemo={openDemo} />
        <TrustStrip />
        <ProblemSolution />
        <FeaturesBento />
        <ProductShowcase />
        <RolesSection />
        <HowItWorks />
        <SecuritySection />
        <FaqSection />
        <FinalCta onRequestDemo={openDemo} />
      </main>
      <SiteFooter onRequestDemo={openDemo} />
      <DemoDialog open={demoOpen} onOpenChange={setDemoOpen} />
    </div>
  );
}
