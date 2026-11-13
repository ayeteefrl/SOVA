import { gateHivePage } from '@/lib/hive/page-gate';
import { hasHiveAccess } from '@/lib/hive/access';
import { parseSymbolParam } from '@/lib/hive/symbol-param';
import { InviteOnly } from '@/components/hive-gate/InviteOnly';
import HiveMount from '@/components/hive-gate/HiveMount';

// The full-screen chart terminal. Access is checked here as well as in the layout (see lib/hive/page-gate.ts),
// and the Hive UI is only loaded (HiveMount) for the owner and members.
export default async function ChartsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await gateHivePage();
  if (!hasHiveAccess(access)) return <InviteOnly />;
  const { symbol } = await searchParams;
  return <HiveMount page="terminal" userId={access.userId!} isOwner={access.role === 'owner'} initialSymbol={parseSymbolParam(symbol)} />;
}
