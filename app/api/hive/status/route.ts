// GET /api/hive/status: UI hints only (lock icon, "Open chart" buttons). The real gate is server-side.
import { NextResponse } from 'next/server';
import { getHiveAccess } from '@/lib/hive/access';

export const dynamic = 'force-dynamic';

export async function GET() {
  const a = await getHiveAccess();
  if (!a.signedIn) return NextResponse.json({ authenticated: false }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json(
    { authenticated: true, isOwner: a.role === 'owner', isMember: a.role === 'owner' || a.role === 'member' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
