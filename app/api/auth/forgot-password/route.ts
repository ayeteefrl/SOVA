import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createHash, randomBytes } from 'crypto';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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

      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

      // Send reset email via Resend (if configured)
      if (resend) {
        await resend.emails.send({
          from: 'noreply@sova.finance',
          to: email,
          subject: 'Reset Your SOVA Password',
          html: `
            <div style="font-family: Manrope, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="font-size: 24px; color: #adc6ff; margin: 0; letter-spacing: -0.5px;">SOVA</h1>
                <p style="color: #8c909f; font-size: 12px; margin: 5px 0; text-transform: uppercase; letter-spacing: 0.1em;">Private Wealth Terminal</p>
              </div>

              <p style="color: #dde2f8; font-size: 14px; margin-bottom: 20px;">We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>

              <div style="background: #0f1526; border: 1px solid rgba(66,71,84,0.5); border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%); color: #001a42; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">
                  Reset Password
                </a>
              </div>

              <p style="color: #8c909f; font-size: 12px; margin: 20px 0; line-height: 1.6;">This link expires in 1 hour. If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="color: #adc6ff; font-size: 11px; word-break: break-all; margin: 15px 0; padding: 10px; background: #1a2035; border-radius: 8px; border-left: 3px solid #adc6ff;">${resetUrl}</p>

              <p style="color: #8c909f; font-size: 11px; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(66,71,84,0.3);">
                This is an automated message from SOVA. Please do not reply to this email.
              </p>
            </div>
          `,
        });
        console.info(`[forgot-password] Reset link sent to ${email}`);
      } else {
        // Development: log token to console instead of sending
        console.info(`[forgot-password] DEV MODE - Reset link: ${resetUrl}`);
      }
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Forgot password error:', err);
    return NextResponse.json({ error: 'Failed to send reset email' }, { status: 500 });
  }
}
