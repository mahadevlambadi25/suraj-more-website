import 'server-only';
import type { WorkshopCohort } from '@prisma/client';
import { z } from 'zod';
import { prisma, UUID_RE } from './db';
import { paiseToRupees } from './money';
import type { Cohort, CohortSession, PublicCohort } from './types';

export const sessionsSchema = z.array(
  z.object({ label: z.string(), startsAt: z.string(), endsAt: z.string(), topic: z.string() }),
);

/** Sample cohorts are hidden in production unless explicitly allowed. Read at call time. */
export function hideSamples() {
  return process.env.NODE_ENV === 'production' && process.env.ALLOW_SAMPLE_CONTENT !== 'true';
}

/**
 * The single purchasability rule, used by the public pages AND enforced again at order creation:
 * open, not a hidden sample, and not yet started. Closed/expired cohorts can never be booked.
 */
export function isCohortPurchasable(c: { status: string; startsAt: Date | string; isSample?: boolean; sample?: boolean }, now = Date.now()) {
  if (c.status !== 'OPEN' && c.status !== 'open') return false;
  if (hideSamples() && (c.isSample || c.sample)) return false;
  return new Date(c.startsAt).getTime() > now;
}

/** DB row → content shape used by the existing UI (rupees for display). Never includes Zoom details. */
export function toCohort(row: WorkshopCohort): Cohort {
  const parsed = sessionsSchema.safeParse(row.sessions);
  const sessions: CohortSession[] = parsed.success ? parsed.data : [];
  return {
    id: row.id,
    slug: row.slug,
    programId: 'workshop',
    title: row.title,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    timezone: row.timezone,
    status: row.status.toLowerCase() as Cohort['status'],
    seatLimit: row.seatLimit,
    priceInr: paiseToRupees(row.pricePaise),
    compareAtPriceInr: row.compareAtPricePaise != null ? paiseToRupees(row.compareAtPricePaise) : null,
    compareAtPriceVerified: row.compareAtPriceVerified,
    vipAddon: { active: row.vipAddonActive, priceInr: paiseToRupees(row.vipAddonPricePaise), title: row.vipAddonTitle, includes: row.vipAddonIncludes },
    sessions,
    reminderCopy: row.reminderCopy,
    sample: row.isSample,
  };
}

export function toPublicCohort(c: Cohort): PublicCohort {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { reminderCopy, ...rest } = c;
  return rest;
}

/** Every publicly listed cohort: OPEN, not started, not a hidden sample — soonest first. */
export async function findOpenCohortRows(now = Date.now()) {
  const rows = await prisma.workshopCohort.findMany({
    where: { status: 'OPEN', startsAt: { gt: new Date(now) } },
    orderBy: { startsAt: 'asc' },
    take: 50,
  });
  return rows.filter((r) => isCohortPurchasable(r, now));
}

/** The next upcoming cohort (announcement strip, offer ladder, post-training CTA). */
export async function findActiveCohortRow(now = Date.now()) {
  return (await findOpenCohortRows(now))[0] ?? null;
}

export async function findCohortRowBySlug(slug: string) {
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  return prisma.workshopCohort.findUnique({ where: { slug } });
}

export async function findCohortRow(id: string) {
  if (!UUID_RE.test(id)) return null;
  return prisma.workshopCohort.findUnique({ where: { id } });
}

/** Seats taken = paid/under-review orders + pending orders from the last 30 minutes (checkout in progress). */
export async function seatsTaken(cohortId: string) {
  return prisma.order.count({
    where: {
      cohortId,
      OR: [{ status: { in: ['PAID', 'NEEDS_REVIEW', 'REFUND_PENDING'] } }, { status: 'PENDING', createdAt: { gte: new Date(Date.now() - 30 * 60_000) } }],
    },
  });
}
