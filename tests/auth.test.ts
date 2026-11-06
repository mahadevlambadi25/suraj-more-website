import { describe, expect, it } from 'vitest';
import * as cmd from '@/lib/admin/commands';
import { hashPassword, passwordProblems, verifyPassword } from '@/lib/auth/password';
import { assertRole, AuthError, createSession, login, revokeSession, SESSION_ABSOLUTE_MS, SESSION_IDLE_MS, validateSessionToken } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { makeAdmin } from './helpers';

const meta = { ip: '203.0.113.7', userAgent: 'vitest' };

describe('password hashing', () => {
  it('hashes with scrypt and verifies', async () => {
    const h = await hashPassword('a strong pass 123');
    expect(h.startsWith('scrypt$')).toBe(true);
    expect(h).not.toContain('a strong pass 123');
    expect(await verifyPassword('a strong pass 123', h)).toBe(true);
    expect(await verifyPassword('wrong pass 123', h)).toBe(false);
  });

  it('rejects weak passwords', () => {
    expect(passwordProblems('short1')).toMatch(/12/);
    expect(passwordProblems('onlyletterslongenough')).toMatch(/number/);
    expect(passwordProblems('good password 2026')).toBeNull();
  });
});

describe('login', () => {
  it('accepts valid credentials, creates a hashed session and audits it', async () => {
    const a = await makeAdmin('ADMIN');
    const r = await login(a.email, a.password, meta);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const session = await prisma.adminSession.findFirstOrThrow({ where: { adminId: a.id } });
    expect(session.tokenHash).not.toBe(r.token); // raw token never stored
    expect((await validateSessionToken(r.token))?.id).toBe(a.id);
    expect(await prisma.auditLog.count({ where: { action: 'auth.login', adminId: a.id } })).toBe(1);
  });

  it('rejects an invalid password and an unknown email with the same answer', async () => {
    const a = await makeAdmin('ADMIN');
    expect(await login(a.email, 'wrong password 1', meta)).toEqual({ ok: false, reason: 'invalid' });
    expect(await login('nobody@test.in', 'whatever pass 1', meta)).toEqual({ ok: false, reason: 'invalid' });
    expect(await prisma.adminSession.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: 'auth.login_failed' } })).toBe(2);
  });

  it('rejects deactivated admins', async () => {
    const a = await makeAdmin('ADMIN');
    await prisma.admin.update({ where: { id: a.id }, data: { isActive: false } });
    expect((await login(a.email, a.password, meta)).ok).toBe(false);
  });

  it('rate limits repeated attempts for one email (5 per 15 minutes)', async () => {
    const a = await makeAdmin('ADMIN');
    for (let i = 0; i < 5; i++) expect(await login(a.email, 'wrong password 1', meta)).toEqual({ ok: false, reason: 'invalid' });
    // Even the correct password is refused while limited.
    expect(await login(a.email, a.password, meta)).toEqual({ ok: false, reason: 'rate_limited' });
  });

  it('never locks out an admin for successful sign-ins (only failures count)', async () => {
    const a = await makeAdmin('ADMIN');
    for (let i = 0; i < 8; i++) expect((await login(a.email, a.password, meta)).ok).toBe(true);
    // A few mistakes after that still leave room for the correct password.
    for (let i = 0; i < 4; i++) await login(a.email, 'wrong password 1', meta);
    expect((await login(a.email, a.password, meta)).ok).toBe(true);
  });

  it('attempts rejected while locked do not extend the lock', async () => {
    const a = await makeAdmin('ADMIN');
    for (let i = 0; i < 5; i++) await login(a.email, 'wrong password 1', meta);
    for (let i = 0; i < 3; i++) expect((await login(a.email, a.password, meta)).ok).toBe(false);
    expect(await prisma.rateLimitEvent.count({ where: { bucket: 'login:email' } })).toBe(5);
  });
});

describe('sessions', () => {
  it('expires after the absolute lifetime', async () => {
    const a = await makeAdmin();
    const { token } = await createSession(a.id);
    expect(await validateSessionToken(token, Date.now() + SESSION_ABSOLUTE_MS + 1000)).toBeNull();
    expect(await prisma.adminSession.count()).toBe(0); // expired session is deleted
  });

  it('expires after the idle timeout', async () => {
    const a = await makeAdmin();
    const { token } = await createSession(a.id);
    expect(await validateSessionToken(token, Date.now() + SESSION_IDLE_MS + 1000)).toBeNull();
  });

  it('rejects missing, garbage and revoked tokens (unauthenticated access)', async () => {
    const a = await makeAdmin();
    const { token } = await createSession(a.id);
    expect(await validateSessionToken(null)).toBeNull();
    expect(await validateSessionToken('not-a-real-token-but-long-enough')).toBeNull();
    await revokeSession(token);
    expect(await validateSessionToken(token)).toBeNull();
  });

  it('stops working immediately when the admin is deactivated', async () => {
    const a = await makeAdmin();
    const { token } = await createSession(a.id);
    await prisma.admin.update({ where: { id: a.id }, data: { isActive: false } });
    expect(await validateSessionToken(token)).toBeNull();
  });
});

describe('authorization', () => {
  it('enforces the role hierarchy', () => {
    expect(() => assertRole(null, 'VIEWER')).toThrow(AuthError);
    expect(() => assertRole({ role: 'VIEWER' }, 'ADMIN')).toThrow(/permission/);
    expect(() => assertRole({ role: 'ADMIN' }, 'OWNER')).toThrow(/permission/);
    expect(() => assertRole({ role: 'OWNER' }, 'ADMIN')).not.toThrow();
  });

  it('refuses privileged commands for viewers and unauthenticated callers (service layer, not just UI)', async () => {
    const viewer = await makeAdmin('VIEWER');
    const admin = await makeAdmin('ADMIN');
    const fakeId = '00000000-0000-4000-8000-000000000000';
    await expect(cmd.refundOrder(viewer.actor, fakeId, 'test reason')).rejects.toThrow(/permission/);
    await expect(cmd.retryWebhook(viewer.actor, fakeId)).rejects.toThrow(/permission/);
    await expect(cmd.decideApplication(viewer.actor, fakeId, 'ACCEPTED', '')).rejects.toThrow(/permission/);
    await expect(cmd.saveCohort(viewer.actor, null, {})).rejects.toThrow(/permission/);
    await expect(cmd.updateSettings(admin.actor, { contactEmail: 'x@y.in' })).rejects.toThrow(/permission/); // OWNER only
    await expect(cmd.refundOrder(null as never, fakeId, 'test reason')).rejects.toThrow(/sign in/i);
  });
});
