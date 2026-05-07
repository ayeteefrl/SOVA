import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createHash } from 'crypto';
import { hash } from 'bcryptjs';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = new Date().toISOString();

    // Check if token exists and is not expired
    const { data: resetToken } = await supabase
      .from('password_reset_tokens')
      .select('id, used')
      .eq('token_hash', tokenHash)
      .gt('expires_at', now)
      .eq('used', false)
      .single();

    if (!resetToken) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    return NextResponse.json({ valid: true });
  } catch (err) {
    console.error('Token verification error:', err);
    return NextResponse.json({ error: 'Failed to verify token' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = new Date().toISOString();

    // Find valid token and get user
    const { data: resetToken } = await supabase
      .from('password_reset_tokens')
      .select('user_id, used')
      .eq('token_hash', tokenHash)
      .gt('expires_at', now)
      .eq('used', false)
      .single();

    if (!resetToken) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    // Hash new password with bcryptjs (10 salt rounds, same as login route)
    const hashedPassword = await hash(password, 10);

    // Update user password_hash in users table
    await supabase
      .from('users')
      .update({ password_hash: hashedPassword })
      .eq('id', resetToken.user_id);

    // Mark token as used
    await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('token_hash', tokenHash);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Password reset error:', err);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
