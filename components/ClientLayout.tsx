'use client';

import { useEffect } from 'react';
import { SidebarProvider, useSidebar } from './SidebarContext';
import { SettingsProvider } from './SettingsContext';
import { HoldingsProvider } from './HoldingsContext';
import { UserProvider } from './UserContext';
import { GlobalActivityPanel } from './GlobalActivityPanel';

// Silently refresh Kite token every 55 min so it doesn't expire mid-session
function KiteKeepAlive() {
  useEffect(() => {
    const ping = () =>
      fetch('/api/auth/kite/refresh', { method: 'POST' }).catch(() => {});
    ping(); // immediate check on mount
    const id = setInterval(ping, 55 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return null;
}

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { mobileOpen, closeMobile } = useSidebar();
  return (
    <div className="flex flex-1 min-h-0 relative">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}
      {children}
      <GlobalActivityPanel />
    </div>
  );
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <HoldingsProvider>
        <SettingsProvider>
          <SidebarProvider>
            <KiteKeepAlive />
            <LayoutInner>{children}</LayoutInner>
          </SidebarProvider>
        </SettingsProvider>
      </HoldingsProvider>
    </UserProvider>
  );
}
