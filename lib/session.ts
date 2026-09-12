import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export interface Session {
  userId: string;
  email: string;
}

export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sova_session')?.value;

    if (!token) return null;

    if (!process.env.SESSION_SECRET) {
      throw new Error('SESSION_SECRET is not set');
    }
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    const verified = await jwtVerify(token, secret);
    return verified.payload as unknown as Session;
  } catch (err) {
    if (err instanceof Error && err.message === 'SESSION_SECRET is not set') {
      console.error('[session] SESSION_SECRET is not set — refusing all sessions');
    }
    return null;
  }
}
