import 'server-only';
import crypto from 'crypto';
import { prisma } from './db';
import { env } from './env';

/** One-way hash for IPs / identifiers we only need to compare (rate limits, audit). */
export function hashIdentifier(value: string) {
  return crypto.createHash('sha256').update(`${env.hashSalt}:${value}`).digest('hex').slice(0, 32);
}

export function clientIp(headers: Headers) {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'local';
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Database-backed sliding-window rate limit (works across serverless instances).
 * Returns true when the caller is OVER the limit.
 */
export async function isRateLimited(bucket: string, rawKey: string, max: number, windowMs: number) {
  if ((await recentHits(bucket, rawKey, windowMs)) >= max) return true;
  await recordHit(bucket, rawKey);
  return false;
}

/** Number of recorded hits for this bucket/key inside the window (does not record anything). */
export function recentHits(bucket: string, rawKey: string, windowMs: number) {
  return prisma.rateLimitEvent.count({ where: { bucket, key: hashIdentifier(rawKey), createdAt: { gte: new Date(Date.now() - windowMs) } } });
}

export async function recordHit(bucket: string, rawKey: string) {
  await prisma.rateLimitEvent.create({ data: { bucket, key: hashIdentifier(rawKey) } });
  if (Math.random() < 0.02) {
    // Opportunistic pruning keeps the table small without a cron job.
    await prisma.rateLimitEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86_400_000) } } }).catch(() => undefined);
  }
}

/** Strips anything that looks like a credential before an error is logged or stored. */
export function safeError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const secrets = [process.env.CASHFREE_SECRET_KEY, process.env.CASHFREE_WEBHOOK_SECRET, process.env.DATABASE_URL, process.env.DIRECT_URL].filter(
    (s): s is string => !!s && s.length > 6,
  );
  return secrets.reduce((m, s) => m.split(s).join('[redacted]'), msg).slice(0, 1000);
}
