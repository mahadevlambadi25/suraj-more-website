import { afterAll, afterEach, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/db';

const BASE_ENV = { ...process.env };

beforeEach(async () => {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.env = { ...BASE_ENV };
});

afterAll(async () => {
  await prisma.$disconnect();
});
