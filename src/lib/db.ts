import 'server-only';
import { Prisma, PrismaClient } from '@prisma/client';

// One PrismaClient per server instance. In dev, cache on globalThis so hot reloads don't open new pools.
// On Vercel, DATABASE_URL must be the *pooled* connection string (Neon "-pooler" host) — see docs/DATABASE.md.
const g = globalThis as unknown as { __prisma?: PrismaClient };

export const prisma =
  g.__prisma ??
  new PrismaClient({
    // Outside development, Prisma's own error logging is off: its messages can include query arguments
    // (personal data). Errors still throw and are logged by our handlers via safeError().
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : [],
  });

if (process.env.NODE_ENV !== 'production') g.__prisma = prisma;

export type Tx = Prisma.TransactionClient;
export type Db = PrismaClient | Tx;

export function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
