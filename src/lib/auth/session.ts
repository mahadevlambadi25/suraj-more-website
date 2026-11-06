import 'server-only';
import crypto from 'crypto';
import type { Admin, AdminRole } from '@prisma/client';
import { audit } from '../audit';
import { prisma } from '../db';
import { hashIdentifier, randomToken, recentHits, recordHit } from '../security';
import { DUMMY_HASH, verifyPassword } from './password';

// Pure session logic (no Next.js APIs) so it is unit-testable. Cookie handling lives in ./guards.ts.

export const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000; // hard expiry
export const SESSION_IDLE_MS = 2 * 60 * 60 * 1000; // inactivity timeout
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES_PER_EMAIL = 5;
export const LOGIN_MAX_FAILURES_PER_IP = 20;
export const SESSION_COOKIE =process.env.NODE_ENV === 'production' ? '__Host-sm_admin' : 'sm_admin';

const RANK: Record<AdminRole, number> = { VIEWER: 1, ADMIN: 2, OWNER: 3 };

export type SessionAdmin = Pick<Admin, 'id' | 'email' | 'name' | 'role'>;

export class AuthError extends Error {
  constructor(public code: 'UNAUTHENTICATED' | 'FORBIDDEN') {
    super(code === 'UNAUTHENTICATED' ? 'Please sign in.' : 'You do not have permission to do this.');
  }
}

export function hasRole(admin: { role: AdminRole }, min: AdminRole) {
  return RANK[admin.role] >= RANK[min];
}

/** Defence in depth: every privileged service function calls this, not just the UI layer. */
export function assertRole(actor: { role: AdminRole } | null | undefined, min: AdminRole): asserts actor is SessionAdmin {
  if (!actor) throw new AuthError('UNAUTHENTICATED');
  if (!hasRole(actor, min)) throw new AuthError('FORBIDDEN');
}

function tokenHash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(adminId: string, meta: { ip?: string; userAgent?: string } = {}) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_ABSOLUTE_MS);
  await prisma.adminSession.create({
    data: { adminId, tokenHash: tokenHash(token), expiresAt, ipHash: meta.ip ? hashIdentifier(meta.ip) : null, userAgent: meta.userAgent?.slice(0, 200) },
  });
  return { token, expiresAt };
}

/** Returns the admin for a valid, unexpired, non-idle session; deletes dead sessions. */
export async function validateSessionToken(token: string | undefined | null, now = Date.now()): Promise<SessionAdmin | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const session = await prisma.adminSession.findUnique({ where: { tokenHash: tokenHash(token) }, include: { admin: true } });
  if (!session) return null;
  const expired = session.expiresAt.getTime() <= now || session.lastSeenAt.getTime() + SESSION_IDLE_MS <= now;
  if (expired || !session.admin.isActive) {
    await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (now - session.lastSeenAt.getTime() > 60_000) {
    await prisma.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date(now) } }).catch(() => undefined);
  }
  const { id, email, name, role } = session.admin;
  return { id, email, name, role };
}

export async function revokeSession(token: string) {
  await prisma.adminSession.deleteMany({ where: { tokenHash: tokenHash(token) } });
}

export type LoginResult = { ok: true; token: string; expiresAt: Date; admin: SessionAdmin } | { ok: false; reason: 'invalid' | 'rate_limited' };

/**
 * Password login. Rate limited per IP (20 / 15 min) and per email (5 / 15 min) in the database,
 * constant-time-ish for unknown emails, and audited either way. Error messages never reveal which part was wrong.
 */
export async function login(emailRaw: string, password: string, meta: { ip: string; userAgent?: string }): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase().slice(0, 200);
  const ipHash = hashIdentifier(meta.ip);
  // Only FAILED attempts count towards the limit; successful sign-ins never lock anyone out,
  // and attempts rejected while locked do not extend the lock.
  if ((await recentHits('login:ip', meta.ip, LOGIN_WINDOW_MS)) >= LOGIN_MAX_FAILURES_PER_IP || (await recentHits('login:email', email, LOGIN_WINDOW_MS)) >= LOGIN_MAX_FAILURES_PER_EMAIL) {
    await audit({ action: 'auth.login_rate_limited', metadata: { email }, ipHash });
    return { ok: false, reason: 'rate_limited' };
  }

  const admin = await prisma.admin.findUnique({ where: { email } });
  const valid = await verifyPassword(password, admin?.passwordHash ?? DUMMY_HASH);
  if (!admin || !valid || !admin.isActive) {
    await Promise.all([recordHit('login:ip', meta.ip), recordHit('login:email', email)]);
    await audit({ adminId: admin?.id, action: 'auth.login_failed', metadata: { email }, ipHash });
    return { ok: false, reason: 'invalid' };
  }

  const { token, expiresAt } = await createSession(admin.id, meta);
  await prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  await audit({ adminId: admin.id, action: 'auth.login', ipHash });
  return { ok: true, token, expiresAt, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } };
}
