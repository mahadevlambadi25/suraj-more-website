// Read-only queries behind the redesigned operations panel.
import { describe, expect, it } from 'vitest';
import { applicationStatusCounts, globalSearch, leadStatusSummary, listRecentOrders, notificationSummary, orderStatusCounts, recentActivity, webhookStatusCounts } from '@/lib/admin/dashboard';
import { getOverviewStats } from '@/lib/admin/queries';
import { prisma } from '@/lib/db';
import { submitMentorshipApplication } from '@/lib/forms';
import { createWorkshopOrder, handleCashfreeEvent } from '@/lib/orders';
import { mentorshipSchema } from '@/lib/validation';
import { buyer, failedEvent, makeCohort, successEvent } from './helpers';

const MOCK = { provider: 'MOCK' as const, signatureVerified: false };

async function seed() {
  const cohort = await makeCohort();
  const paid = await createWorkshopOrder(buyer({ cohortId: cohort.id, email: 'paid@test.in' }), undefined);
  await handleCashfreeEvent(successEvent(paid.orderId, 47), 'p', MOCK);
  const failed = await createWorkshopOrder(buyer({ cohortId: cohort.id, email: 'failed@test.in' }), undefined);
  await handleCashfreeEvent(failedEvent(failed.orderId, 47), 'f', MOCK);
  await createWorkshopOrder(buyer({ cohortId: cohort.id, email: 'pending@test.in' }), undefined);
  const app = await submitMentorshipApplication(
    mentorshipSchema.parse({ name: 'Ravi Kumar', email: 'ravi@test.in', phone: '+91 99999 11111', link: 'ravi.in', offer: 'B2B consulting for SaaS founders', salesChallenge: 'Prospects stall after discovery', desiredOutcome: 'A repeatable call structure', timeline: 'now', timezone: 'Asia/Kolkata', marketingConsent: false }),
    undefined,
  );
  return { paid, failed, app };
}

describe('operations panel queries', () => {
  it('overview stats include total orders', async () => {
    await seed();
    expect(await getOverviewStats()).toMatchObject({ orders: 3, paidOrders: 1, pending: 1, failed: 1, revenuePaise: 4700, applications: 1 });
  });

  it('recent orders are newest first', async () => {
    await seed();
    const orders = await listRecentOrders(2);
    expect(orders).toHaveLength(2);
    expect(orders[0].createdAt.getTime()).toBeGreaterThanOrEqual(orders[1].createdAt.getTime());
    expect(orders[0].cohort.title).toBeTruthy();
  });

  it('activity feed merges real events, newest first, each linking to its record', async () => {
    const { app } = await seed();
    const feed = await recentActivity(20);
    const kinds = new Set(feed.map((a) => a.kind));
    expect(kinds).toEqual(new Set(['lead', 'order_paid', 'order_failed', 'order_created', 'application']));
    for (let i = 1; i < feed.length; i++) expect(feed[i - 1].at.getTime()).toBeGreaterThanOrEqual(feed[i].at.getTime());
    expect(feed.find((a) => a.kind === 'application')?.href).toBe(`/ops/applications/${app.applicationId}`);
    expect(feed.every((a) => a.href.startsWith('/ops/'))).toBe(true);
  });

  it('lead status summary covers every status and adds up', async () => {
    await seed();
    await prisma.lead.updateMany({ where: { email: 'ravi@test.in' }, data: { status: 'QUALIFIED' } });
    const s = await leadStatusSummary();
    expect(s.rows.map((r) => r.status)).toEqual(['NEW', 'CONTACTED', 'QUALIFIED', 'CUSTOMER', 'UNSUBSCRIBED']);
    expect(s.rows.reduce((n, r) => n + r.count, 0)).toBe(s.total);
    expect(s.rows.find((r) => r.status === 'QUALIFIED')?.count).toBe(1);
    expect(s.rows.find((r) => r.status === 'CUSTOMER')?.count).toBe(1); // the paid buyer
  });

  it('status counts match the filters', async () => {
    await seed();
    expect(await orderStatusCounts()).toMatchObject({ all: 3, paid: 1, pending: 1, failed: 1, refunded: 0, review: 0 });
    expect(await applicationStatusCounts()).toEqual({ all: 1, new: 1, accepted: 0, rejected: 0 });
    expect(await webhookStatusCounts()).toMatchObject({ all: 2, processed: 2, failed: 0 });
  });

  it('notification summary counts items needing attention', async () => {
    await seed();
    const n = await notificationSummary();
    expect(n.newApplications).toBe(1);
    expect(n.failedWebhooks).toBe(0);
    expect(n.attention).toBeGreaterThanOrEqual(1); // the paid order has no delivery provider configured
  });

  it('global search finds leads, orders and applications; ignores 1-character queries', async () => {
    const { paid } = await seed();
    expect((await globalSearch('r')).leads).toHaveLength(0);
    const byName = await globalSearch('ravi');
    expect(byName.leads.map((l) => l.email)).toContain('ravi@test.in');
    expect(byName.applications).toHaveLength(1);
    const byOrder = await globalSearch(paid.orderId);
    expect(byOrder.orders.map((o) => o.orderNumber)).toEqual([paid.orderId]);
    expect((await globalSearch('PAID@TEST')).orders).toHaveLength(1); // case-insensitive email
  });
});
