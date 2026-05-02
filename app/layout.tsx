import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { MarketTicker } from '@/components/MarketTicker';
import { TopBar } from '@/components/TopBar';
import { PageTransition } from '@/components/ui/PageTransition';
import { ClientLayout } from '@/components/ClientLayout';
import { AuthGuard } from '@/components/AuthGuard';
import { KiteAuthBanner } from '@/components/KiteAuthBanner';

export const metadata: Metadata = {
  title: 'SOVA — Private Wealth Portfolio',
  description:
    'A private, editorial wealth portfolio. Tonal, atmospheric, precise — engineered for clarity on capital.',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@200;300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface text-on-surface h-screen flex flex-col">
        <MarketTicker />
        <AuthGuard>
        <ClientLayout>
          <Sidebar />
          <main className="flex-1 overflow-y-auto scrollbar-thin bg-surface relative min-h-0">
            <KiteAuthBanner />
            <div className="sticky top-0 z-30 bg-surface/80 backdrop-blur-lg">
              <TopBar />
            </div>
            <PageTransition>{children}</PageTransition>
          </main>
        </ClientLayout>
        </AuthGuard>
      </body>
    </html>
  );
}
