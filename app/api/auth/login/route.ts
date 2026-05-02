import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { SignJWT } from 'jose';
import { createHash } from 'crypto';
import { supabase } from '@/lib/supabase';

const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const isValid = await compare(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await new SignJWT({ userId: user.id, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('30d')
      .sign(secret);

    // Record active session
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const ua = req.headers.get('user-agent') ?? '';
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? '0.0.0.0';

    let browser = 'Unknown Browser';
    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    let device = 'Desktop';
    if (/iPhone|iPad|iPod/.test(ua)) device = 'iOS';
    else if (/Android/.test(ua)) device = 'Android';
    else if (/Mobile/.test(ua)) device = 'Mobile';

    await supabase.from('user_active_sessions').insert({
      user_id: user.id,
      session_token_hash: tokenHash,
      device_name: device,
      browser,
      ip_address: ip,
    }).select();

    const response = NextResponse.json({ success: true, userId: user.id }, { status: 200 });
    response.cookies.set('sova_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
