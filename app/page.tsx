'use client';

import LandingNav from '@/components/landing/LandingNav';
import HeroSection from '@/components/landing/HeroSection';
import DashboardPreview from '@/components/landing/DashboardPreview';
import StatsBand from '@/components/landing/StatsBand';
import Testimonials from '@/components/landing/Testimonials';
import FAQSection from '@/components/landing/FAQSection';
import LandingFooter from '@/components/landing/LandingFooter';

export default function LandingPage() {
  return (
    <div className="bg-surface min-h-screen text-on-surface overflow-x-hidden">
      <LandingNav />
      <HeroSection />
      <DashboardPreview />
      <StatsBand />
      <Testimonials />
      <FAQSection />
      <LandingFooter />
    </div>
  );
}
