import { describe, expect, it } from 'vitest';
import { isUniqueViolation, prisma } from '@/lib/db';
import { makeCohort } from './helpers';

describe('database', () => {
  it('connects', async () => {
    const r = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    expect(r[0].ok).toBe(1);
  });

  it('has every migration applied and all expected tables', async () => {
    const migrations = await prisma.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`SELECT migration_name, finished_at FROM _prisma_migrations`;
    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations.every((m) => m.finished_at)).toBe(true);
    const tables = (await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public'`).map((t) => t.tablename);
    for (const t of ['Admin', 'AdminSession', 'Lead', 'FreeTrainingRegistration', 'WorkshopCohort', 'WorkshopRegistration', 'Order', 'Payment', 'WebhookEvent', 'MentorshipApplication', 'WaitlistEntry', 'Refund', 'IntegrationEvent', 'AuditLog']) {
      expect(tables).toContain(t);
    }
  });

  it('stores money as integer paise', async () => {
    const cols = await prisma.$queryRaw<{ column_name: string; data_type: string }[]>`
      SELECT column_name, data_type FROM information_schema.columns WHERE table_name IN ('Order','Payment','Refund','WorkshopCohort') AND column_name ILIKE '%paise%'`;
    expect(cols.length).toBeGreaterThanOrEqual(6);
    expect(cols.every((c) => c.data_type === 'integer')).toBe(true);
  });

  it('creates, reads and updates records', async () => {
    const lead = await prisma.lead.create({ data: { email: 'a@test.in', name: 'A', source: 'FREE_TRAINING' } });
    expect((await prisma.lead.findUnique({ where: { id: lead.id } }))?.email).toBe('a@test.in');
    await prisma.lead.update({ where: { id: lead.id }, data: { status: 'CONTACTED' } });
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('CONTACTED');
  });

  it('enforces unique constraints (lead email, webhook idempotency key, provider payment id, cohort slug)', async () => {
    await prisma.lead.create({ data: { email: 'dup@test.in', name: 'A', source: 'FREE_TRAINING' } });
    await expect(prisma.lead.create({ data: { email: 'dup@test.in', name: 'B', source: 'WAITLIST' } })).rejects.toSatisfy(isUniqueViolation);

    const ev = { provider: 'CASHFREE' as const, idempotencyKey: 'k1', eventType: 'X', signatureVerified: true, payload: {} };
    await prisma.webhookEvent.create({ data: ev });
    await expect(prisma.webhookEvent.create({ data: ev })).rejects.toSatisfy(isUniqueViolation);

    const c = await makeCohort({ slug: 'same-slug' });
    await expect(makeCohort({ slug: 'same-slug' })).rejects.toSatisfy(isUniqueViolation);

    const lead = await prisma.lead.findUniqueOrThrow({ where: { email: 'dup@test.in' } });
    const order = await prisma.order.create({
      data: { orderNumber: 'o1', cohortId: c.id, leadId: lead.id, customerName: 'A', customerEmail: 'dup@test.in', customerPhone: '1', lineItems: [], amountPaise: 4700, provider: 'CASHFREE', providerMode: 'sandbox', termsVersion: '1', termsAcceptedAt: new Date() },
    });
    const pay = { orderId: order.id, provider: 'CASHFREE' as const, providerPaymentId: 'p1', status: 'SUCCESS' as const, amountPaise: 4700, currency: 'INR' };
    await prisma.payment.create({ data: pay });
    await expect(prisma.payment.create({ data: pay })).rejects.toSatisfy(isUniqueViolation);
  });

  it('rolls back a failed transaction completely', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.lead.create({ data: { email: 'rollback@test.in', name: 'R', source: 'FREE_TRAINING' } });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await prisma.lead.count({ where: { email: 'rollback@test.in' } })).toBe(0);
  });
});
