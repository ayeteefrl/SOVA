'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const PUBLIC_PATHS = ['/', '/sign-in', '/signup', '/reset-password'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '?'));

  useEffect(() => {
    if (isPublic) {
      setChecked(true);
      setIsAuthenticated(true);
      return;
    }
    fetch('/api/auth/me')
      .then((r) => {
        if (!r.ok) router.push('/sign-in');
        setIsAuthenticated(r.ok);
        setChecked(true);
      })
      .catch(() => {
        router.push('/sign-in');
        setIsAuthenticated(false);
        setChecked(true);
      });
  }, [pathname, isPublic, router]);

  if (!checked || !isAuthenticated) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-surface">
        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
