import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { jwtVerify } from 'jose';

const SESSION_SECRET = new TextEncoder().encode(process.env.SESSION_SECRET ?? 'fallback-secret');

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const cookie = req.cookies.get('sova_session')?.value;
  if (!cookie) return null;
  try {
    const { payload } = await jwtVerify(cookie, SESSION_SECRET);
    return (payload as { userId?: string }).userId ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Both fields are required' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
  }

  const { data: user } = await supabase
    .from('users')
    .select('id, password_hash')
    .eq('id', userId)
    .single();

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });

  const newHash = await bcrypt.hash(newPassword, 10);
  await supabase.from('users').update({ password_hash: newHash }).eq('id', userId);

  // Revoke all sessions except current
  const currentToken = req.cookies.get('sova_session')?.value ?? '';
  const currentHash = createHash('sha256').update(currentToken).digest('hex');
  await supabase
    .from('user_active_sessions')
    .delete()
    .eq('user_id', userId)
    .neq('session_token_hash', currentHash);

  return NextResponse.json({ success: true });
}
