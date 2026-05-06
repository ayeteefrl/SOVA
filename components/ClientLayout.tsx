'use client';

import { SidebarProvider, useSidebar } from './SidebarContext';
import { SettingsProvider } from './SettingsContext';
import { HoldingsProvider } from './HoldingsContext';
import { UserProvider } from './UserContext';
import { GlobalActivityPanel } from './GlobalActivityPanel';

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
            <LayoutInner>{children}</LayoutInner>
          </SidebarProvider>
        </SettingsProvider>
      </HoldingsProvider>
    </UserProvider>
  );
}
