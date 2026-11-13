'use client';

import { usePathname } from 'next/navigation';
import { AuthGuard } from './AuthGuard';
import { ClientLayout } from './ClientLayout';
import { Sidebar } from './Sidebar';
import { MarketTicker } from './MarketTicker';
import { TopBar } from './TopBar';
import { KiteAuthBanner } from './KiteAuthBanner';
import { ErrorBoundary } from './ErrorBoundary';
import { PageTransition } from './ui/PageTransition';
import { SmoothScroll } from './SmoothScroll';

// Routes that render without the app shell (no sidebar, topbar, or ticker)
const AUTH_PATHS = ['/', '/sign-in', '/signup', '/reset-password'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + '?'));

  // Charts (Chart Hive) is full-viewport with its own shell: no sidebar, topbar, ticker or smooth
  // scroll. Access is enforced server-side in app/charts/layout.tsx and each /charts page.
  if (pathname === '/charts' || pathname.startsWith('/charts/')) {
    return <ErrorBoundary label="Charts">{children}</ErrorBoundary>;
  }

  if (isAuthPage) {
    return (
      <SmoothScroll className="flex-1 min-h-0 overflow-y-auto bg-surface">
        <ErrorBoundary label="Page content">{children}</ErrorBoundary>
      </SmoothScroll>
    );
  }

  return (
    <>
      <ErrorBoundary label="Market Ticker">
        <MarketTicker />
      </ErrorBoundary>
      <AuthGuard>
        <ClientLayout>
          <ErrorBoundary label="Sidebar">
            <Sidebar />
          </ErrorBoundary>
          <main className="flex-1 flex flex-col min-h-0 bg-surface relative">
            <SmoothScroll className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
              <KiteAuthBanner />
              <TopBar />
              <ErrorBoundary label="Page content">
                <PageTransition>{children}</PageTransition>
              </ErrorBoundary>
            </SmoothScroll>
          </main>
        </ClientLayout>
      </AuthGuard>
    </>
  );
}
