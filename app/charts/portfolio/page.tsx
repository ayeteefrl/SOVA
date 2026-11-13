import { gateHivePage } from '@/lib/hive/page-gate';
import { hasHiveAccess } from '@/lib/hive/access';
import { InviteOnly } from '@/components/hive-gate/InviteOnly';
import HiveMount from '@/components/hive-gate/HiveMount';

// Access is checked here as well as in the layout (see lib/hive/page-gate.ts); the Hive UI loads only for members.
export default async function Page() {
  const access = await gateHivePage();
  if (!hasHiveAccess(access)) return <InviteOnly />;
  return <HiveMount page="portfolio" userId={access.userId!} isOwner={access.role === 'owner'} />;
}
