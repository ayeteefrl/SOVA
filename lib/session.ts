import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);

export interface Session {
  userId: string;
  email: string;
}

export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sova_session')?.value;

    if (!token) return null;

    const verified = await jwtVerify(token, secret);
    return verified.payload as unknown as Session;
  } catch (err) {
    return null;
  }
}
