import type { Metadata } from 'next';
import { gateHivePage } from '@/lib/hive/page-gate';
import { hasHiveAccess } from '@/lib/hive/access';
import { InviteOnly } from '@/components/hive-gate/InviteOnly';

export const metadata: Metadata = { title: 'Charts · SOVA' };

// Server-side gate for every /charts route. Pages repeat the check (see lib/hive/page-gate.ts).
export default async function ChartsLayout({ children }: { children: React.ReactNode }) {
  const access = await gateHivePage();
  if (!hasHiveAccess(access)) return <InviteOnly />;
  return <div className="flex-1 min-h-0 flex flex-col">{children}</div>;
}
