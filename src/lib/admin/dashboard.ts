import 'server-only';
import { prisma } from '../db';
import { needsAttentionWhere } from './queries';

// Read-only queries for the redesigned operations panel: overview widgets, notification counts,
// status counts for filters, and global search. Nothing here writes to the database.

export function listRecentOrders(take = 6) {
  return prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take, include: { cohort: { select: { title: true } } } });
}

export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CUSTOMER', 'UNSUBSCRIBED'] as const;

export async function leadStatusSummary() {
  const rows = await prisma.lead.groupBy({ by: ['status'], _count: true });
  const map = new Map(rows.map((r) => [r.status as string, r._count]));
  const total = rows.reduce((s, r) => s + r._count, 0);
  return { total, rows: LEAD_STATUSES.map((status) => ({ status, count: map.get(status) ?? 0 })) };
}

export type ActivityKind = 'lead' | 'order_paid' | 'order_failed' | 'order_created' | 'application' | 'waitlist' | 'refund';
export interface Activity {
  kind: ActivityKind;
  at: Date;
  title: string;
  detail?: string;
  href: string;
}

/** Latest business events, merged from the existing tables (no separate activity table). */
export async function recentActivity(take = 10): Promise<Activity[]> {
  const [leads, orders, apps, waitlist, refunds] = await Promise.all([
    prisma.lead.findMany({ orderBy: { createdAt: 'desc' }, take, select: { id: true, name: true, source: true, createdAt: true } }),
    prisma.order.findMany({ orderBy: { updatedAt: 'desc' }, take, select: { id: true, orderNumber: true, customerName: true, status: true, createdAt: true, paidAt: true, updatedAt: true } }),
    prisma.mentorshipApplication.findMany({ orderBy: { createdAt: 'desc' }, take, select: { id: true, name: true, createdAt: true } }),
    prisma.waitlistEntry.findMany({ orderBy: { createdAt: 'desc' }, take, select: { leadId: true, name: true, programId: true, createdAt: true } }),
    prisma.refund.findMany({ orderBy: { createdAt: 'desc' }, take, select: { orderId: true, refundNumber: true, status: true, createdAt: true } }),
  ]);

  const orderItem = (o: (typeof orders)[number]): Activity => {
    if (o.status === 'PAID' && o.paidAt) return { kind: 'order_paid', at: o.paidAt, title: `Payment received from ${o.customerName}`, detail: o.orderNumber, href: `/ops/orders/${o.id}` };
    if (o.status === 'FAILED' || o.status === 'DROPPED') return { kind: 'order_failed', at: o.updatedAt, title: `Payment not completed: ${o.customerName}`, detail: o.orderNumber, href: `/ops/orders/${o.id}` };
    if (o.status === 'NEEDS_REVIEW') return { kind: 'order_failed', at: o.updatedAt, title: `Order needs review: ${o.customerName}`, detail: o.orderNumber, href: `/ops/orders/${o.id}` };
    return { kind: 'order_created', at: o.createdAt, title: `Checkout started by ${o.customerName}`, detail: o.orderNumber, href: `/ops/orders/${o.id}` };
  };

  const items: Activity[] = [
    ...leads.map((l): Activity => ({ kind: 'lead', at: l.createdAt, title: `New lead: ${l.name}`, detail: `via ${l.source.replace(/_/g, ' ').toLowerCase()}`, href: `/ops/leads/${l.id}` })),
    ...orders.map(orderItem),
    ...apps.map((a): Activity => ({ kind: 'application', at: a.createdAt, title: `Mentorship application from ${a.name}`, href: `/ops/applications/${a.id}` })),
    ...waitlist.map((w): Activity => ({ kind: 'waitlist', at: w.createdAt, title: `${w.name} joined the ${w.programId} waitlist`, href: `/ops/leads/${w.leadId}` })),
    ...refunds.map((r): Activity => ({ kind: 'refund', at: r.createdAt, title: `Refund ${r.status.toLowerCase()}`, detail: r.refundNumber, href: `/ops/orders/${r.orderId}` })),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, take);
}

/** Counts behind the notification bell and sidebar badges. */
export async function notificationSummary() {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [attention, failedWebhooks, newApplications, deliveryProblems, pendingRefunds] = await Promise.all([
    prisma.order.count({ where: needsAttentionWhere() }),
    prisma.webhookEvent.count({ where: { status: 'FAILED' } }),
    prisma.mentorshipApplication.count({ where: { status: 'NEW' } }),
    prisma.integrationEvent.count({ where: { status: 'FAILED', createdAt: { gte: weekAgo } } }),
    prisma.refund.count({ where: { status: { in: ['PENDING', 'ONHOLD'] } } }),
  ]);
  return { attention, failedWebhooks, newApplications, deliveryProblems, pendingRefunds };
}

/** Global search across leads, orders and applications (name, email, phone, order number). */
export async function globalSearch(raw: string) {
  const q = raw.trim().slice(0, 100);
  if (q.length < 2) return { q, leads: [], orders: [], applications: [] };
  const text = { contains: q, mode: 'insensitive' as const };
  const [leads, orders, applications] = await Promise.all([
    prisma.lead.findMany({ where: { OR: [{ name: text }, { email: text }, { phone: { contains: q } }] }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.order.findMany({
      where: { OR: [{ orderNumber: { contains: q } }, { customerEmail: text }, { customerName: text }, { providerOrderId: { contains: q } }] },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { cohort: { select: { title: true } } },
    }),
    prisma.mentorshipApplication.findMany({ where: { OR: [{ name: text }, { email: text }] }, orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);
  return { q, leads, orders, applications };
}

// ── Status counts for segmented filters ──
export async function orderStatusCounts() {
  const [rows, attention] = await Promise.all([prisma.order.groupBy({ by: ['status'], _count: true }), prisma.order.count({ where: needsAttentionWhere() })]);
  const c = (s: string[]) => rows.filter((r) => s.includes(r.status)).reduce((n, r) => n + r._count, 0);
  return {
    all: rows.reduce((n, r) => n + r._count, 0),
    paid: c(['PAID']),
    pending: c(['PENDING']),
    failed: c(['FAILED', 'DROPPED']),
    refunded: c(['REFUNDED', 'REFUND_PENDING']),
    review: c(['NEEDS_REVIEW']),
    attention,
  };
}

export async function applicationStatusCounts() {
  const rows = await prisma.mentorshipApplication.groupBy({ by: ['status'], _count: true });
  const get = (s: string) => rows.find((r) => r.status === s)?._count ?? 0;
  return { all: rows.reduce((n, r) => n + r._count, 0), new: get('NEW'), accepted: get('ACCEPTED'), rejected: get('REJECTED') };
}

export async function webhookStatusCounts() {
  const rows = await prisma.webhookEvent.groupBy({ by: ['status'], _count: true });
  const get = (s: string) => rows.find((r) => r.status === s)?._count ?? 0;
  return { all: rows.reduce((n, r) => n + r._count, 0), received: get('RECEIVED'), processed: get('PROCESSED'), failed: get('FAILED'), ignored: get('IGNORED') };
}
