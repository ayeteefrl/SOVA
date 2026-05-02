'use client';

import { usePathname } from 'next/navigation';
import { ActivityPanel } from './ActivityPanel';

const HIDDEN_PATHS = ['/settings', '/login', '/register'];

export function GlobalActivityPanel() {
  const path = usePathname();
  if (HIDDEN_PATHS.some((p) => path.startsWith(p))) return null;
  return <ActivityPanel />;
}
