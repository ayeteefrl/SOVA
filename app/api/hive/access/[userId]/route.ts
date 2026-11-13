// Owner-only: DELETE /api/hive/access/<userId> removes a member. The row is deleted (no soft delete).
// Live sessions end when the member's current data token expires (at most 10 minutes).
import { NextResponse } from 'next/server';
import { getHiveAccess, forgetMembership, isMissingTable } from '@/lib/hive/access';
import { isUuid } from '@/lib/hive/access-core';
import { supabase } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { sameOriginRequest } from '@/lib/hive/request-guard';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

export async function DELETE(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  if (!sameOriginRequest(req)) return json({ error: 'Forbidden' }, 403);
  const a = await getHiveAccess();
  if (!a.signedIn) return json({ error: 'Unauthorized' }, 401);
  if (a.role !== 'owner') return json({ error: 'Forbidden' }, 403);

  const { userId: raw } = await params;
  if (!isUuid(raw)) return json({ error: 'Invalid member id' }, 400);
  const userId = raw.toLowerCase();
  if (userId === a.userId) return json({ error: 'You cannot remove yourself; you are the owner.' }, 400);

  const rl = await checkRateLimit(`hive-access:${a.userId}`, 30, 600).catch(() => ({ allowed: true, retryAfterSeconds: 0 }));
  if (!rl.allowed) return json({ error: 'Too many changes. Try again shortly.' }, 429, { 'Retry-After': String(rl.retryAfterSeconds) });

  const { data, error } = await supabase.from('hive_access').delete().eq('user_id', userId).select('user_id');
  if (error) {
    if (isMissingTable(error)) return json({ error: 'The hive_access table does not exist yet.' }, 503);
    console.error('[hive] remove member failed:', error.code);
    return json({ error: 'Could not remove that member' }, 500);
  }
  forgetMembership(userId);
  if (!data?.length) return json({ error: 'Not a member' }, 404);
  return json({ ok: true });
}
