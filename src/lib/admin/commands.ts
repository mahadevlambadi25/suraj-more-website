import 'server-only';
import type { LeadStatus } from '@prisma/client';
import { audit } from '../audit';
import { assertRole, type SessionAdmin } from '../auth/session';
import { isUniqueViolation, prisma, UUID_RE } from '../db';
import { crmSync, sendMessage } from '../integrations';
import { fulfilOrder, processWebhookEvent, reconcileOrder, requestRefund, syncRefund } from '../orders';
import { safeError } from '../security';
import { EDITABLE_SETTINGS, getMentorshipBookingUrl, type SettingKey } from '../settings';
import { cohortFormSchema, cohortFormToData } from './cohort-form';
import { caseStudyFormSchema, issues, testimonialFormSchema } from './proof-form';

// Privileged operations. Each one: (1) checks the actor's role itself, (2) does the work through the
// same domain services the public flow uses, (3) writes an audit log entry.
// There is intentionally NO operation that marks an order paid — only verified provider events can.

export class CommandError extends Error {}

type Actor = SessionAdmin & { ipHash?: string };

function uuid(id: string) {
  if (!UUID_RE.test(id)) throw new CommandError('Invalid id');
  return id;
}

// ── Leads ──
const LEAD_STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'CUSTOMER', 'UNSUBSCRIBED'];

export async function updateLeadStatus(actor: Actor, leadId: string, status: string) {
  assertRole(actor, 'ADMIN');
  if (!LEAD_STATUSES.includes(status as LeadStatus)) throw new CommandError('Invalid status');
  const before = await prisma.lead.findUniqueOrThrow({ where: { id: uuid(leadId) }, select: { status: true } });
  await prisma.lead.update({ where: { id: leadId }, data: { status: status as LeadStatus } });
  await audit({ adminId: actor.id, action: 'lead.status', entityType: 'lead', entityId: leadId, metadata: { from: before.status, to: status }, ipHash: actor.ipHash });
}

// ── Cohorts ──
export async function saveCohort(actor: Actor, cohortId: string | null, raw: Record<string, unknown>) {
  assertRole(actor, 'ADMIN');
  const parsed = cohortFormSchema.safeParse(raw);
  if (!parsed.success) throw new CommandError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · '));
  let data;
  try {
    data = cohortFormToData(parsed.data);
  } catch (err) {
    throw new CommandError(err instanceof Error ? err.message : 'Invalid sessions');
  }

  if (!cohortId) {
    try {
      const c = await prisma.workshopCohort.create({ data: { slug: parsed.data.slug, ...data } });
      await audit({ adminId: actor.id, action: 'cohort.create', entityType: 'cohort', entityId: c.id, metadata: { slug: c.slug, status: c.status, pricePaise: c.pricePaise }, ipHash: actor.ipHash });
      return c;
    } catch (err) {
      if (isUniqueViolation(err)) throw new CommandError('A cohort with this slug already exists');
      throw err;
    }
  }
  const before = await prisma.workshopCohort.findUniqueOrThrow({ where: { id: uuid(cohortId) } });
  // Slug is immutable (orders and tags reference it). Price changes only affect NEW orders.
  const c = await prisma.workshopCohort.update({ where: { id: cohortId }, data });
  const changed = (Object.keys(data) as (keyof typeof data)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(c[k]) && k !== 'zoomPasscode');
  await audit({ adminId: actor.id, action: 'cohort.update', entityType: 'cohort', entityId: c.id, metadata: { changed, statusFrom: before.status, statusTo: c.status, pricePaiseFrom: before.pricePaise, pricePaiseTo: c.pricePaise }, ipHash: actor.ipHash });
  return c;
}

// ── Proof: testimonials & case studies (PRD §8.2 / §11.2 / §11.5) ──
export async function saveTestimonial(actor: Actor, id: string | null, raw: Record<string, unknown>) {
  assertRole(actor, 'ADMIN');
  const parsed = testimonialFormSchema.safeParse(raw);
  if (!parsed.success) throw new CommandError(issues(parsed.error));
  const data = parsed.data;
  const t = id ? await prisma.testimonial.update({ where: { id: uuid(id) }, data }) : await prisma.testimonial.create({ data });
  await audit({ adminId: actor.id, action: id ? 'testimonial.update' : 'testimonial.create', entityType: 'testimonial', entityId: t.id, metadata: { status: t.status, permissionOnFile: t.permissionOnFile }, ipHash: actor.ipHash });
  return t;
}

export async function deleteTestimonial(actor: Actor, id: string) {
  assertRole(actor, 'ADMIN');
  const t = await prisma.testimonial.delete({ where: { id: uuid(id) } }).catch(() => null);
  if (!t) throw new CommandError('Testimonial not found');
  await audit({ adminId: actor.id, action: 'testimonial.delete', entityType: 'testimonial', entityId: id, metadata: { client: t.client }, ipHash: actor.ipHash });
}

export async function saveCaseStudy(actor: Actor, id: string | null, raw: Record<string, unknown>) {
  assertRole(actor, 'ADMIN');
  const parsed = caseStudyFormSchema.safeParse(raw);
  if (!parsed.success) throw new CommandError(issues(parsed.error));
  const data = parsed.data;
  const c = id ? await prisma.caseStudy.update({ where: { id: uuid(id) }, data }) : await prisma.caseStudy.create({ data });
  await audit({ adminId: actor.id, action: id ? 'case_study.update' : 'case_study.create', entityType: 'case_study', entityId: c.id, metadata: { status: c.status, permissionOnFile: c.permissionOnFile }, ipHash: actor.ipHash });
  return c;
}

export async function deleteCaseStudy(actor: Actor, id: string) {
  assertRole(actor, 'ADMIN');
  const c = await prisma.caseStudy.delete({ where: { id: uuid(id) } }).catch(() => null);
  if (!c) throw new CommandError('Case study not found');
  await audit({ adminId: actor.id, action: 'case_study.delete', entityType: 'case_study', entityId: id, metadata: { client: c.client }, ipHash: actor.ipHash });
}

// ── Orders & payments ──
export async function refundOrder(actor: Actor, orderId: string, reason: string) {
  assertRole(actor, 'ADMIN');
  const why = reason.trim();
  if (why.length < 5) throw new CommandError('Please give a reason (at least 5 characters)');
  try {
    const refund = await requestRefund(uuid(orderId), { adminId: actor.id, reason: why.slice(0, 300) });
    await audit({ adminId: actor.id, action: 'refund.request', entityType: 'order', entityId: orderId, metadata: { refundNumber: refund.refundNumber, amountPaise: refund.amountPaise, reason: why }, ipHash: actor.ipHash });
    return refund;
  } catch (err) {
    await audit({ adminId: actor.id, action: 'refund.request_failed', entityType: 'order', entityId: orderId, metadata: { error: safeError(err) }, ipHash: actor.ipHash });
    throw new CommandError(safeError(err));
  }
}

export async function syncRefundStatus(actor: Actor, refundId: string) {
  assertRole(actor, 'ADMIN');
  const status = await syncRefund(uuid(refundId));
  await audit({ adminId: actor.id, action: 'refund.sync', entityType: 'refund', entityId: refundId, metadata: { status }, ipHash: actor.ipHash });
  return status;
}

export async function reconcile(actor: Actor, orderId: string) {
  assertRole(actor, 'ADMIN');
  const order = await prisma.order.findUniqueOrThrow({ where: { id: uuid(orderId) } });
  const status = await reconcileOrder(order.orderNumber, true);
  await audit({ adminId: actor.id, action: 'order.reconcile', entityType: 'order', entityId: orderId, metadata: { status }, ipHash: actor.ipHash });
  return status;
}

export async function retryFulfilment(actor: Actor, orderId: string) {
  assertRole(actor, 'ADMIN');
  const order = await prisma.order.findUniqueOrThrow({ where: { id: uuid(orderId) } });
  if (order.status !== 'PAID') throw new CommandError('Only paid orders can be fulfilled');
  await fulfilOrder(orderId);
  await audit({ adminId: actor.id, action: 'order.retry_fulfilment', entityType: 'order', entityId: orderId, ipHash: actor.ipHash });
}

// ── Webhooks ──
export async function retryWebhook(actor: Actor, eventId: string) {
  assertRole(actor, 'ADMIN');
  const ev = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: uuid(eventId) } });
  if (ev.status !== 'FAILED' && ev.status !== 'RECEIVED') throw new CommandError(`Event is ${ev.status}; only failed events can be retried`);
  if ((ev.payload as { legacyImport?: boolean })?.legacyImport) throw new CommandError('Imported legacy events have no payload and cannot be retried');
  let result: string;
  try {
    result = await processWebhookEvent(ev.id); // idempotent: underlying transitions are compare-and-set
  } catch (err) {
    result = `FAILED: ${safeError(err)}`;
  }
  await audit({ adminId: actor.id, action: 'webhook.retry', entityType: 'webhook', entityId: eventId, metadata: { result }, ipHash: actor.ipHash });
  if (result.startsWith('FAILED')) throw new CommandError(result);
  return result;
}

// ── Mentorship applications ──
export async function decideApplication(actor: Actor, applicationId: string, decision: 'ACCEPTED' | 'REJECTED', note: string) {
  assertRole(actor, 'ADMIN');
  const bookingUrl = decision === 'ACCEPTED' ? await getMentorshipBookingUrl() : '';
  if (decision === 'ACCEPTED' && !bookingUrl) throw new CommandError('Set the mentorship booking link in Settings before accepting applications.');

  // Compare-and-set: only a NEW application can be decided, exactly once.
  const upd = await prisma.mentorshipApplication.updateMany({
    where: { id: uuid(applicationId), status: 'NEW' },
    data: { status: decision, decidedAt: new Date(), decidedById: actor.id, decisionNote: note.trim().slice(0, 1000) || null },
  });
  if (upd.count === 0) throw new CommandError('Application not found or already decided');
  const app = await prisma.mentorshipApplication.findUniqueOrThrow({ where: { id: applicationId } });

  const related = { relatedType: 'application', relatedId: app.id };
  // The booking provider (Calendly / Cal.com / Topmate) handles availability, timezone, reminders and reschedule/cancel.
  const delivery = await sendMessage({
    kind: 'transactional',
    channel: 'email',
    template: decision === 'ACCEPTED' ? 'mentorship_application_accepted' : 'mentorship_application_declined',
    to: app.email,
    data: { name: app.name, timezone: app.timezone, bookingUrl: decision === 'ACCEPTED' ? bookingUrl : undefined },
    ...related,
  });
  if (decision === 'ACCEPTED' && delivery === 'SENT') {
    await prisma.mentorshipApplication.update({ where: { id: app.id }, data: { bookingLinkSentAt: new Date() } });
  }
  await crmSync({ type: 'application_status', email: app.email, tags: [`application:${decision.toLowerCase()}`], fields: { applicationId: app.id }, ...related });
  await audit({ adminId: actor.id, action: decision === 'ACCEPTED' ? 'application.accept' : 'application.reject', entityType: 'application', entityId: app.id, metadata: { delivery }, ipHash: actor.ipHash });
  return { delivery };
}

// ── Settings ──
export async function updateSettings(actor: Actor, raw: Record<string, string>) {
  assertRole(actor, 'OWNER');
  const errors: string[] = [];
  const values: Partial<Record<SettingKey, string>> = {};
  for (const [key, def] of Object.entries(EDITABLE_SETTINGS) as [SettingKey, (typeof EDITABLE_SETTINGS)[SettingKey]][]) {
    if (!(key in raw)) continue;
    const r = def.schema.safeParse(raw[key] ?? '');
    if (r.success) values[key] = r.data;
    else errors.push(`${def.label}: ${r.error.issues[0]?.message}`);
  }
  if (errors.length) throw new CommandError(errors.join(' · '));
  await prisma.$transaction(
    Object.entries(values).map(([key, value]) => prisma.appSetting.upsert({ where: { key }, create: { key, value, updatedById: actor.id }, update: { value, updatedById: actor.id } })),
  );
  await audit({ adminId: actor.id, action: 'settings.update', entityType: 'settings', metadata: { keys: Object.keys(values) }, ipHash: actor.ipHash });
}

export async function setAdminActive(actor: Actor, adminId: string, active: boolean) {
  assertRole(actor, 'OWNER');
  if (adminId === actor.id) throw new CommandError('You cannot deactivate yourself');
  await prisma.$transaction([
    prisma.admin.update({ where: { id: uuid(adminId) }, data: { isActive: active } }),
    ...(active ? [] : [prisma.adminSession.deleteMany({ where: { adminId } })]),
  ]);
  await audit({ adminId: actor.id, action: active ? 'admin.activate' : 'admin.deactivate', entityType: 'admin', entityId: adminId, ipHash: actor.ipHash });
}
