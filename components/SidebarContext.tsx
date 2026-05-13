'use client';

import { createContext, useContext, useState, useEffect } from 'react';

interface SidebarCtxType {
  collapsed: boolean;
  mobileOpen: boolean;
  toggleCollapse: () => void;
  toggleMobile: () => void;
  closeMobile: () => void;
}

const SidebarCtx = createContext<SidebarCtxType>({
  collapsed: false,
  mobileOpen: false,
  toggleCollapse: () => {},
  toggleMobile: () => {},
  closeMobile: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Default: collapsed on screens narrower than 1280px (vertical monitors, small laptops)
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1280;
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function handler() {
      const w = window.innerWidth;
      if (w >= 1024) setMobileOpen(false);
      // Auto-collapse when dropping below 1280px; auto-expand above 1280px
      // only if the user hasn't manually toggled (we track via a flag)
      setCollapsed((prev) => {
        // Below mobile breakpoint: sidebar is a drawer anyway — ignore collapsed
        if (w < 1024) return prev;
        // Between 1024–1279px: force collapsed
        if (w < 1280) return true;
        // ≥1280px: keep whatever the user last chose
        return prev;
      });
    }
    handler(); // run once on mount
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return (
    <SidebarCtx.Provider
      value={{
        collapsed,
        mobileOpen,
        toggleCollapse: () => setCollapsed((v) => !v),
        toggleMobile: () => setMobileOpen((v) => !v),
        closeMobile: () => setMobileOpen(false),
      }}
    >
      {children}
    </SidebarCtx.Provider>
  );
}

export const useSidebar = () => useContext(SidebarCtx);
