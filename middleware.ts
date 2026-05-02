import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);

const PUBLIC_PATHS = ['/login', '/register'];
const PUBLIC_API_PREFIX = '/api/auth/';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public pages and all auth API routes through
  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith(PUBLIC_API_PREFIX)
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get('sova_session')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.set('sova_session', '', { maxAge: 0, path: '/' });
    return res;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg|.*\\.ico).*)',
  ],
};
