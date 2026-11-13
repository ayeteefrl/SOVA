import { redirect } from 'next/navigation';
import { gateHivePage } from '@/lib/hive/page-gate';
import { hasHiveAccess } from '@/lib/hive/access';
import { InviteOnly } from '@/components/hive-gate/InviteOnly';
import { AccessAdminMount } from '@/components/hive-gate/HiveMount';

export const metadata = { title: 'Charts access · SOVA' };

// Owner only. Members are sent back to the terminal; the API routes refuse them as well.
export default async function AccessPage() {
  const access = await gateHivePage();
  if (!hasHiveAccess(access)) return <InviteOnly />;
  if (access.role !== 'owner') redirect('/charts');
  return <AccessAdminMount />;
}
