'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const PUBLIC_PATHS = ['/login', '/register'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (PUBLIC_PATHS.includes(pathname)) {
      setChecked(true);
      return;
    }
    fetch('/api/auth/me')
      .then((r) => {
        if (!r.ok) router.replace('/login');
        else setChecked(true);
      })
      .catch(() => router.replace('/login'));
  }, [pathname, router]);

  if (!checked) return null;
  return <>{children}</>;
}
