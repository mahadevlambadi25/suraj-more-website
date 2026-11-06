import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma, type Db } from './db';

export function audit(
  entry: { adminId?: string | null; action: string; entityType?: string; entityId?: string; metadata?: Record<string, unknown>; ipHash?: string },
  db: Db = prisma,
) {
  return db.auditLog.create({
    data: {
      adminId: entry.adminId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata as Prisma.InputJsonValue | undefined,
      ipHash: entry.ipHash,
    },
  });
}
