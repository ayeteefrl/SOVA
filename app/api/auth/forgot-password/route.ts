import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createHash, randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Check user exists — don't reveal whether they do or not in the response
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (user) {
      // Generate a secure reset token (1-hour expiry)
      const token = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await supabase.from('password_reset_tokens').upsert({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        used: false,
      }, { onConflict: 'user_id' });

      // In production: send email here via Resend / SendGrid / Supabase Auth emails
      // The reset link would be: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`
      console.info(`[forgot-password] Reset token for ${email}: ${token}`);
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Forgot password error:', err);
    return NextResponse.json({ error: 'Failed to send reset email' }, { status: 500 });
  }
}
