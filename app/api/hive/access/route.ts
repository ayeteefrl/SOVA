// Owner-only: list and add Chart Hive members.
//   GET  /api/hive/access                 -> { members: [{ userId, email, note, createdAt }], tableMissing }
//   POST /api/hive/access {email, note?}  -> adds the EXISTING SOVA account with that email
import { NextResponse } from 'next/server';
import { getHiveAccess, forgetMembership, isMissingTable } from '@/lib/hive/access';
import { supabase } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { escapeLike, parseEmail, parseNote, pickAccount } from '@/lib/hive/admin-core';
import { isJson, sameOriginRequest } from '@/lib/hive/request-guard';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

async function ownerOnly() {
  const a = await getHiveAccess();
  if (!a.signedIn) return { res: json({ error: 'Unauthorized' }, 401) };
  if (a.role !== 'owner') return { res: json({ error: 'Forbidden' }, 403) };
  return { owner: a.userId! };
}

export async function GET() {
  const g = await ownerOnly();
  if (g.res) return g.res;
  const { data, error } = await supabase
    .from('hive_access')
    .select('user_id, email, note, created_at')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    if (isMissingTable(error)) return json({ members: [], tableMissing: true });
    console.error('[hive] list members failed:', error.code);
    return json({ error: 'Could not load the access list' }, 500);
  }
  return json({
    members: (data || []).map((r) => ({ userId: r.user_id, email: r.email, note: r.note, createdAt: r.created_at })),
    tableMissing: false,
  });
}

export async function POST(req: Request) {
  if (!sameOriginRequest(req) || !isJson(req)) return json({ error: 'Forbidden' }, 403);
  const g = await ownerOnly();
  if (g.res) return g.res;

  const rl = await checkRateLimit(`hive-access:${g.owner}`, 30, 600).catch(() => ({ allowed: true, retryAfterSeconds: 0 }));
  if (!rl.allowed) return json({ error: 'Too many changes. Try again shortly.' }, 429, { 'Retry-After': String(rl.retryAfterSeconds) });

  const body = await req.json().catch(() => null);
  const email = parseEmail(body?.email);
  const note = parseNote(body?.note);
  if (!email) return json({ error: 'Enter a valid email address' }, 400);
  if (note === undefined) return json({ error: 'Note must be text of at most 200 characters' }, 400);

  const [exact, loose] = await Promise.all([
    supabase.from('users').select('id, email').eq('email', email).limit(2),
    supabase.from('users').select('id, email').ilike('email', escapeLike(email)).limit(3),
  ]);
  if (exact.error || loose.error) return json({ error: 'Could not look up that account' }, 500);
  const pick = pickAccount(email, exact.data || [], loose.data || []);
  if ('error' in pick) {
    return pick.error === 'none'
      ? json({ error: 'That person needs to sign up on SOVA first.' }, 404)
      : json({ error: 'More than one SOVA account matches that email with different capitalisation. Type it exactly as they registered it.' }, 409);
  }
  const user = pick.account;
  if (user.id === g.owner) return json({ error: 'You are the owner and always have access.' }, 400);

  const { error } = await supabase.from('hive_access').insert({ user_id: user.id, email: user.email, added_by: g.owner, note });
  if (error) {
    if (error.code === '23505') return json({ error: 'That account is already a member.' }, 409);
    if (isMissingTable(error)) return json({ error: 'The hive_access table does not exist yet. Run supabase-hive-access.sql first.' }, 503);
    console.error('[hive] add member failed:', error.code);
    return json({ error: 'Could not add that member' }, 500);
  }
  forgetMembership(user.id);
  return json({ ok: true, member: { userId: user.id, email: user.email, note } }, 201);
}
