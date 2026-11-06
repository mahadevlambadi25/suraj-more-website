import 'server-only';
import type { AdminRole } from '@prisma/client';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { clientIp, hashIdentifier } from '../security';
import { assertRole, hasRole, SESSION_COOKIE, validateSessionToken, type SessionAdmin } from './session';

// Next.js glue: cookies + redirects. All real checks live in ./session.ts.

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function getCurrentAdmin(): Promise<SessionAdmin | null> {
  return validateSessionToken(await getSessionToken());
}

/** For pages: redirects to the login screen when not signed in; 403 page when the role is too low. */
export async function requireAdmin(min: AdminRole = 'VIEWER'): Promise<SessionAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/ops/login');
  if (!hasRole(admin, min)) redirect('/ops?denied=1');
  return admin;
}

/** For server actions / route handlers: throws AuthError (never trusts hidden UI). */
export async function requireAdminAction(min: AdminRole): Promise<SessionAdmin> {
  const admin = await getCurrentAdmin();
  assertRole(admin, min);
  return admin;
}

export async function requestMeta() {
  const h = await headers();
  const ip = clientIp(h);
  return { ip, ipHash: hashIdentifier(ip), userAgent: h.get('user-agent') ?? undefined };
}
