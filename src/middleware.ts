import { NextResponse, type NextRequest } from 'next/server';

/**
 * First line of defence for /ops: no session cookie → straight to the login page.
 * This is NOT the authorization check — every dashboard page, server action and route handler
 * validates the session against the database and checks the admin's role (src/lib/auth/guards.ts).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/ops/login') return NextResponse.next();
  const hasCookie = req.cookies.has('__Host-sm_admin') || req.cookies.has('sm_admin');
  if (!hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = '/ops/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export const config = { matcher: ['/ops', '/ops/:path*'] };
