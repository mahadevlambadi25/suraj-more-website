import 'server-only';
import type { ApplicationStatus, LeadSource, LeadStatus, OrderStatus, Prisma, WebhookStatus } from '@prisma/client';
import { prisma, UUID_RE } from '../db';

export const PAGE_SIZE = 50;

/** IST calendar date (YYYY-MM-DD) → UTC instant at the start/end of that day. */
export function istDayBound(date: string | undefined, end: boolean) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  return new Date(`${date}T${end ? '23:59:59.999' : '00:00:00.000'}+05:30`);
}

// ───────────────────────────── Overview ─────────────────────────────

export async function getOverviewStats() {
  const [orders, leads, registrations, paidOrders, revenue, pending, failed, applications, newApplications, waitlist, failedWebhooks] = await Promise.all([
    prisma.order.count(),
    prisma.lead.count(),
    prisma.workshopRegistration.count({ where: { status: 'CONFIRMED' } }),
    prisma.order.count({ where: { status: 'PAID' } }),
    prisma.order.aggregate({ where: { status: { in: ['PAID', 'REFUND_PENDING'] } }, _sum: { amountPaise: true } }),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.order.count({ where: { status: { in: ['FAILED', 'DROPPED'] } } }),
    prisma.mentorshipApplication.count(),
    prisma.mentorshipApplication.count({ where: { status: 'NEW' } }),
    prisma.waitlistEntry.count(),
    prisma.webhookEvent.count({ where: { status: 'FAILED' } }),
  ]);
  return { orders, leads, registrations, paidOrders, revenuePaise: revenue._sum.amountPaise ?? 0, pending, failed, applications, newApplications, waitlist, failedWebhooks };
}

/** Orders that need a human: amount mismatch, stale pending, paid but not fully delivered. */
export function needsAttentionWhere(): Prisma.OrderWhereInput {
  return {
    OR: [
      { status: 'NEEDS_REVIEW' },
      { status: 'PENDING', createdAt: { lt: new Date(Date.now() - 15 * 60_000) }, provider: 'CASHFREE' },
      { status: 'PAID', OR: [{ fulfilmentError: { not: null } }, { zoomSentAt: null }, { confirmationSentAt: null }] },
    ],
  };
}

export function listNeedsAttention(take = 20) {
  return prisma.order.findMany({ where: needsAttentionWhere(), orderBy: { createdAt: 'desc' }, take, include: { cohort: { select: { title: true } } } });
}

// ───────────────────────────── Leads ─────────────────────────────

export interface LeadFilters {
  q?: string;
  source?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
}

export function leadWhere(f: LeadFilters): Prisma.LeadWhereInput {
  const q = f.q?.trim().slice(0, 100);
  return {
    ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] } : {}),
    ...(f.source ? { source: f.source as LeadSource } : {}),
    ...(f.status ? { status: f.status as LeadStatus } : {}),
    ...(f.from || f.to ? { createdAt: { gte: istDayBound(f.from, false), lte: istDayBound(f.to, true) } } : {}),
  };
}

export async function listLeads(f: LeadFilters) {
  const where = leadWhere(f);
  const page = Math.max(1, f.page ?? 1);
  const [rows, total] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.lead.count({ where }),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export function getLead(id: string) {
  if (!UUID_RE.test(id)) return null;
  return prisma.lead.findUnique({
    where: { id },
    include: {
      consents: { orderBy: { createdAt: 'desc' } },
      freeTrainingRegistrations: { orderBy: { createdAt: 'desc' } },
      orders: { orderBy: { createdAt: 'desc' }, include: { cohort: { select: { title: true } } } },
      applications: { orderBy: { createdAt: 'desc' } },
      waitlistEntries: { orderBy: { createdAt: 'desc' } },
    },
  });
}

/** Excel/Sheets formula-injection safe CSV cell. */
export function csvCell(v: unknown) {
  let s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function leadsCsv(f: LeadFilters) {
  const rows = await prisma.lead.findMany({
    where: leadWhere(f),
    orderBy: { createdAt: 'desc' },
    take: 10_000,
    include: { consents: { where: { type: 'MARKETING' }, orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  const header = ['created_at', 'name', 'email', 'phone', 'source', 'status', 'marketing_consent', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'referrer', 'landing_page'];
  const lines = rows.map((l) =>
    [l.createdAt, l.name, l.email, l.phone, l.source, l.status, l.consents[0]?.granted ? 'yes' : 'no', l.utmSource, l.utmMedium, l.utmCampaign, l.utmTerm, l.utmContent, l.referrer, l.landingPage]
      .map(csvCell)
      .join(','),
  );
  return { csv: [header.join(','), ...lines].join('\r\n'), count: rows.length };
}

// ───────────────────────────── Workshops ─────────────────────────────

export async function listCohorts() {
  const cohorts = await prisma.workshopCohort.findMany({ orderBy: { startsAt: 'desc' } });
  const counts = await prisma.workshopRegistration.groupBy({ by: ['cohortId'], where: { status: 'CONFIRMED' }, _count: true });
  const map = new Map(counts.map((c) => [c.cohortId, c._count]));
  return cohorts.map((c) => ({ ...c, confirmed: map.get(c.id) ?? 0 }));
}

export async function getCohortDetail(id: string) {
  if (!UUID_RE.test(id)) return null;
  const cohort = await prisma.workshopCohort.findUnique({
    where: { id },
    include: { registrations: { orderBy: { createdAt: 'desc' }, include: { order: { select: { orderNumber: true, amountPaise: true, status: true } } } } },
  });
  if (!cohort) return null;
  const waitlist = await prisma.waitlistEntry.findMany({ where: { programId: 'workshop' }, orderBy: { createdAt: 'desc' }, take: 500 });
  return { cohort, waitlist };
}

// ───────────────────────────── Orders ─────────────────────────────

export const ORDER_FILTERS: Record<string, OrderStatus[] | 'attention'> = {
  paid: ['PAID'],
  pending: ['PENDING'],
  failed: ['FAILED', 'DROPPED'],
  refunded: ['REFUNDED', 'REFUND_PENDING'],
  review: ['NEEDS_REVIEW'],
  attention: 'attention',
};

export async function listOrders(f: { status?: string; q?: string; page?: number }) {
  const filter = f.status ? ORDER_FILTERS[f.status] : undefined;
  const q = f.q?.trim().slice(0, 100);
  const where: Prisma.OrderWhereInput = {
    ...(filter === 'attention' ? needsAttentionWhere() : filter ? { status: { in: filter } } : {}),
    ...(q
      ? { OR: [{ orderNumber: { contains: q } }, { customerEmail: { contains: q, mode: 'insensitive' } }, { customerName: { contains: q, mode: 'insensitive' } }, { providerOrderId: { contains: q } }] }
      : {}),
  };
  const page = Math.max(1, f.page ?? 1);
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { cohort: { select: { title: true } }, payments: { where: { status: 'SUCCESS' }, take: 1 } },
    }),
    prisma.order.count({ where }),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export function getOrderDetail(id: string) {
  if (!UUID_RE.test(id)) return null;
  return prisma.order.findUnique({
    where: { id },
    include: {
      cohort: { select: { id: true, title: true, slug: true } },
      payments: { orderBy: { createdAt: 'asc' } },
      refunds: { orderBy: { createdAt: 'desc' }, include: { requestedBy: { select: { name: true } } } },
      events: { orderBy: { createdAt: 'asc' } },
      webhookEvents: { orderBy: { receivedAt: 'asc' } },
      registration: true,
    },
  });
}

// ───────────────────────────── Webhooks, refunds, applications, audit ─────────────────────────────

export async function listWebhooks(f: { status?: string; page?: number }) {
  const where: Prisma.WebhookEventWhereInput = f.status ? { status: f.status.toUpperCase() as WebhookStatus } : {};
  const page = Math.max(1, f.page ?? 1);
  const [rows, total] = await Promise.all([
    prisma.webhookEvent.findMany({ where, orderBy: { receivedAt: 'desc' }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: { id: true, idempotencyKey: true, eventType: true, provider: true, status: true, attempts: true, lastError: true, receivedAt: true, processedAt: true, orderNumber: true, orderId: true, signatureVerified: true } }),
    prisma.webhookEvent.count({ where }),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export function listRefunds() {
  return prisma.refund.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { order: { select: { id: true, orderNumber: true, customerName: true, customerEmail: true } }, requestedBy: { select: { name: true } } } });
}

export async function listApplications(f: { status?: string; page?: number }) {
  const where: Prisma.MentorshipApplicationWhereInput = f.status ? { status: f.status.toUpperCase() as ApplicationStatus } : {};
  const page = Math.max(1, f.page ?? 1);
  const [rows, total] = await Promise.all([
    prisma.mentorshipApplication.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.mentorshipApplication.count({ where }),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export function getApplication(id: string) {
  if (!UUID_RE.test(id)) return null;
  return prisma.mentorshipApplication.findUnique({ where: { id }, include: { decidedBy: { select: { name: true } } } });
}

export function listAuditLog(take = 100) {
  return prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take, include: { admin: { select: { name: true, email: true } } } });
}

export function listAdmins() {
  return prisma.admin.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, email: true, name: true, role: true, isActive: true, lastLoginAt: true } });
}

export function recentIntegrationProblems(take = 20) {
  return prisma.integrationEvent.findMany({ where: { status: { in: ['FAILED', 'NOT_CONFIGURED'] } }, orderBy: { createdAt: 'desc' }, take });
}

// ───────────────────────────── Proof (testimonials & case studies) ─────────────────────────────

export async function listProof() {
  const [testimonials, caseStudies] = await Promise.all([
    prisma.testimonial.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] }),
    prisma.caseStudy.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] }),
  ]);
  return { testimonials, caseStudies };
}

export function getTestimonial(id: string) {
  return UUID_RE.test(id) ? prisma.testimonial.findUnique({ where: { id } }) : null;
}

export function getCaseStudy(id: string) {
  return UUID_RE.test(id) ? prisma.caseStudy.findUnique({ where: { id } }) : null;
}
