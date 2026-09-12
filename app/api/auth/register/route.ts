import { hash } from 'bcryptjs';
import { supabase } from '@/lib/supabase';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    const rateLimit = await checkRateLimit(`register:${ip}`, 5, 3600);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: 'Too many accounts created from this location. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return Response.json({ error: 'Email and password required' }, { status: 400 });
    }

    if (password.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const passwordHash = await hash(password, 12);

    const { data, error } = await supabase
      .from('users')
      .insert([{ email, password_hash: passwordHash }])
      .select();

    if (error) {
      if (error.code === '23505') {
        return Response.json({ error: 'Email already exists' }, { status: 409 });
      }
      throw error;
    }

    return Response.json({ success: true, userId: data[0].id }, { status: 201 });
  } catch (err) {
    console.error('Register error:', err);
    return Response.json({ error: 'Registration failed' }, { status: 500 });
  }
}
