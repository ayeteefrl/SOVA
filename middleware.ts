import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register'];
const PUBLIC_API_PREFIX = '/api/auth/';

export function middleware(req: NextRequest) {
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
