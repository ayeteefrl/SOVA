import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import LandingNav from '@/components/landing/LandingNav';
import HeroSection from '@/components/landing/HeroSection';
import DashboardPreview from '@/components/landing/DashboardPreview';
import StatsBand from '@/components/landing/StatsBand';
import HowItWorks from '@/components/landing/HowItWorks';
import FAQSection from '@/components/landing/FAQSection';
import LandingFooter from '@/components/landing/LandingFooter';

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect('/home');

  return (
    <div id="landing-top" className="bg-surface min-h-screen text-on-surface overflow-x-hidden">
      <LandingNav />
      <HeroSection />
      <DashboardPreview />
      <StatsBand />
      <HowItWorks />
      <FAQSection />
      <LandingFooter />
    </div>
  );
}
