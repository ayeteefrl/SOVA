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

// Routes that render without the app shell (no sidebar, topbar, or ticker)
const AUTH_PATHS = ['/login', '/register', '/reset-password'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + '?'));

  if (isAuthPage) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto bg-surface">
        <ErrorBoundary label="Page content">{children}</ErrorBoundary>
      </div>
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
          <main className="flex-1 overflow-y-auto scrollbar-thin bg-surface relative min-h-0">
            <KiteAuthBanner />
            <TopBar />
            <ErrorBoundary label="Page content">
              <PageTransition>{children}</PageTransition>
            </ErrorBoundary>
          </main>
        </ClientLayout>
      </AuthGuard>
    </>
  );
}
