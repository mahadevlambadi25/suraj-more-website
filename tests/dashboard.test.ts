import { describe, expect, it } from 'vitest';
import { GET as healthGET } from '@/app/api/health/route';
import * as cmd from '@/lib/admin/commands';
import { parseSessions, toIstInput } from '@/lib/admin/cohort-form';
import { csvCell, getOverviewStats, leadsCsv, listLeads, listOrders, listWebhooks } from '@/lib/admin/queries';
import { getActiveCohort } from '@/lib/cms';
import { prisma } from '@/lib/db';
import { submitMentorshipApplication } from '@/lib/forms';
import { createWorkshopOrder, handleCashfreeEvent } from '@/lib/orders';
import { getMergedSettings } from '@/lib/settings';
import { mentorshipSchema } from '@/lib/validation';
import { buyer, DAY, failedEvent, makeAdmin, makeCohort, successEvent } from './helpers';

const MOCK = { provider: 'MOCK' as const, signatureVerified: false };

async function application(email = 'ravi@test.in') {
  const input = mentorshipSchema.parse({
    name: 'Ravi K', email, phone: '+91 99999 11111', link: 'ravi.in', offer: 'B2B consulting for SaaS founders',
    salesChallenge: 'Prospects stall after discovery', desiredOutcome: 'A repeatable call structure', timeline: 'now', timezone: 'Asia/Kolkata', marketingConsent: false,
  });
  return (await submitMentorshipApplication(input, undefined)).applicationId;
}

describe('overview statistics', () => {
  it('reflects real database state', async () => {
    const cohort = await makeCohort();
    const paid = await createWorkshopOrder(buyer({ cohortId: cohort.id, vipAddon: true }), undefined);
    await handleCashfreeEvent(successEvent(paid.orderId, 546), 'p', MOCK);
    const failed = await createWorkshopOrder(buyer({ cohortId: cohort.id, email: 'f@test.in' }), undefined);
    await handleCashfreeEvent(failedEvent(failed.orderId, 47), 'f', MOCK);
    await createWorkshopOrder(buyer({ cohortId: cohort.id, email: 'p@test.in' }), undefined);
    await application();

    const s = await getOverviewStats();
    expect(s).toMatchObject({ leads: 4, registrations: 1, paidOrders: 1, revenuePaise: 54600, pending: 1, failed: 1, applications: 1, newApplications: 1, waitlist: 0 });
  });
});

describe('leads management', () => {
  it('searches by name/email and filters by source and date (IST)', async () => {
    await prisma.lead.createMany({
      data: [
        { email: 'asha@test.in', name: 'Asha Rao', source: 'FREE_TRAINING', createdAt: new Date('2026-11-01T10:00:00+05:30') },
        { email: 'ravi@test.in', name: 'Ravi K', source: 'MENTORSHIP', createdAt: new Date('2026-11-03T10:00:00+05:30') },
        { email: 'meena@other.in', name: 'Meena', source: 'WAITLIST', createdAt: new Date('2026-11-05T23:30:00+05:30') },
      ],
    });
    expect((await listLeads({ q: 'ASHA' })).rows.map((l) => l.name)).toEqual(['Asha Rao']);
    expect((await listLeads({ q: 'other.in' })).total).toBe(1);
    expect((await listLeads({ source: 'MENTORSHIP' })).rows[0].email).toBe('ravi@test.in');
    expect((await listLeads({ from: '2026-11-02', to: '2026-11-05' })).rows.map((l) => l.name).sort()).toEqual(['Meena', 'Ravi K']);
  });

  it('exports CSV safely (quotes + formula-injection guard)', async () => {
    await prisma.lead.create({ data: { email: 'x@test.in', name: '=HYPERLINK("http://evil")', source: 'FREE_TRAINING', utmCampaign: 'a,b' } });
    const { csv, count } = await leadsCsv({});
    expect(count).toBe(1);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv).toContain('"a,b"');
    expect(csvCell('+1')).toBe("'+1");
  });

  it('tracks lead status changes with an audit entry', async () => {
    const admin = await makeAdmin('ADMIN');
    const lead = await prisma.lead.create({ data: { email: 's@test.in', name: 'S', source: 'FREE_TRAINING' } });
    await cmd.updateLeadStatus(admin.actor, lead.id, 'QUALIFIED');
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('QUALIFIED');
    expect(await prisma.auditLog.findFirst({ where: { action: 'lead.status' } })).toMatchObject({ entityId: lead.id, adminId: admin.id });
    await expect(cmd.updateLeadStatus(admin.actor, lead.id, 'HACKED')).rejects.toThrow(/Invalid status/);
  });
});

describe('workshop management', () => {
  const form = (o: Record<string, unknown> = {}) => ({
    slug: 'osw-2027-01',
    title: 'The One Skill Workshop — Jan',
    startsAt: toIstInput(new Date(Date.now() + 20 * DAY)),
    endsAt: toIstInput(new Date(Date.now() + 21 * DAY)),
    status: 'OPEN',
    seatLimit: '',
    priceRupees: '47',
    compareAtRupees: '',
    compareAtPriceVerified: false,
    vipAddonActive: true,
    vipAddonTitle: 'Recording + VIP Pack',
    vipAddonPriceRupees: '499',
    vipAddonIncludes: 'Workbook, Live Q&A',
    sessions: 'Day 1 | 2027-01-16 11:00 | 14:00 | Intent\nDay 2 | 2027-01-17 11:00 | 14:00 | Certainty → Close',
    reminderCopy: '',
    zoomJoinUrl: 'https://zoom.us/j/999',
    zoomPasscode: '',
    ...o,
  });

  it('creates a cohort (rupees → paise, IST sessions) that becomes the public active cohort', async () => {
    const admin = await makeAdmin('ADMIN');
    const c = await cmd.saveCohort(admin.actor, null, form());
    expect(c.pricePaise).toBe(4700);
    expect(c.vipAddonPricePaise).toBe(49900);
    expect((c.sessions as { startsAt: string }[])[0].startsAt).toBe('2027-01-16T05:30:00.000Z');
    const active = await getActiveCohort();
    expect(active?.id).toBe(c.id);
    expect(JSON.stringify(active)).not.toContain('zoom'); // private delivery never reaches the public layer
    expect(await prisma.auditLog.count({ where: { action: 'cohort.create' } })).toBe(1);
  });

  it('validates input', async () => {
    const admin = await makeAdmin('ADMIN');
    await expect(cmd.saveCohort(admin.actor, null, form({ endsAt: form().startsAt.replace(/T.*/, 'T00:00') }))).rejects.toThrow(/End must be after start/);
    await expect(cmd.saveCohort(admin.actor, null, form({ sessions: 'garbage line' }))).rejects.toThrow(/Session line 1/);
    await expect(cmd.saveCohort(admin.actor, null, form({ zoomJoinUrl: 'http://insecure' }))).rejects.toThrow(/https/);
    expect(() => parseSessions('Day 1 | 2027-01-16 14:00 | 11:00 | x')).toThrow(/end time/);
  });

  it('closing a cohort immediately blocks booking', async () => {
    const admin = await makeAdmin('ADMIN');
    const c = await cmd.saveCohort(admin.actor, null, form());
    await cmd.saveCohort(admin.actor, c.id, form({ status: 'CLOSED' }));
    await expect(createWorkshopOrder(buyer({ cohortId: c.id }), undefined)).rejects.toMatchObject({ code: 'COHORT_CLOSED' });
    expect(await getActiveCohort()).toBeNull();
  });

  it('price changes apply only to new orders', async () => {
    const admin = await makeAdmin('ADMIN');
    const c = await cmd.saveCohort(admin.actor, null, form());
    const before = await createWorkshopOrder(buyer({ cohortId: c.id }), undefined);
    await cmd.saveCohort(admin.actor, c.id, form({ priceRupees: '99' }));
    const after = await createWorkshopOrder(buyer({ cohortId: c.id, email: 'n@test.in' }), undefined);
    const [o1, o2] = await Promise.all([prisma.order.findUniqueOrThrow({ where: { orderNumber: before.orderId } }), prisma.order.findUniqueOrThrow({ where: { orderNumber: after.orderId } })]);
    expect([o1.amountPaise, o2.amountPaise]).toEqual([4700, 9900]);
  });
});

describe('orders, webhooks and applications', () => {
  it('filters payment records by status', async () => {
    const cohort = await makeCohort();
    const a = await createWorkshopOrder(buyer({ cohortId: cohort.id }), undefined);
    await createWorkshopOrder(buyer({ cohortId: cohort.id, email: 'b@test.in' }), undefined);
    await handleCashfreeEvent(successEvent(a.orderId, 47), 'p', MOCK);
    expect((await listOrders({ status: 'paid' })).rows.map((o) => o.orderNumber)).toEqual([a.orderId]);
    expect((await listOrders({ status: 'pending' })).total).toBe(1);
    expect((await listOrders({ q: a.orderId })).rows[0].payments[0].providerPaymentId).toBe('cf_pay_1');
  });

  it('lists webhook events with status and errors', async () => {
    const cohort = await makeCohort();
    const a = await createWorkshopOrder(buyer({ cohortId: cohort.id }), undefined);
    await handleCashfreeEvent(successEvent(a.orderId, 47), 'ok', MOCK);
    await handleCashfreeEvent(successEvent('missing-order', 47), 'bad', MOCK).catch(() => undefined);
    expect((await listWebhooks({ status: 'failed' })).rows[0]).toMatchObject({ idempotencyKey: 'bad', lastError: expect.stringContaining('not found') });
    expect((await listWebhooks({ status: 'processed' })).total).toBe(1);
  });

  it('accepting requires a booking link, decides exactly once, records the honest delivery status and audits', async () => {
    const admin = await makeAdmin('ADMIN');
    const id = await application();
    await expect(cmd.decideApplication(admin.actor, id, 'ACCEPTED', '')).rejects.toThrow(/booking link/);

    process.env.MENTORSHIP_BOOKING_URL = 'https://cal.com/suraj/strategy';
    const { delivery } = await cmd.decideApplication(admin.actor, id, 'ACCEPTED', 'Strong fit');
    expect(delivery).toBe('NOT_CONFIGURED'); // no email provider yet → not claimed as sent
    const app = await prisma.mentorshipApplication.findUniqueOrThrow({ where: { id } });
    expect(app).toMatchObject({ status: 'ACCEPTED', decidedById: admin.id, decisionNote: 'Strong fit', bookingLinkSentAt: null });
    await expect(cmd.decideApplication(admin.actor, id, 'REJECTED', '')).rejects.toThrow(/already decided/);
    expect(await prisma.auditLog.count({ where: { action: 'application.accept', entityId: id } })).toBe(1);
  });

  it('records the booking link as sent only when the email provider accepts it', async () => {
    process.env.MENTORSHIP_BOOKING_URL = 'https://cal.com/suraj/strategy';
    process.env.EMAIL_WEBHOOK_URL = 'https://hooks.test/email';
    const { vi } = await import('vitest');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
    const admin = await makeAdmin('ADMIN');
    const id = await application('sent@test.in');
    expect((await cmd.decideApplication(admin.actor, id, 'ACCEPTED', '')).delivery).toBe('SENT');
    expect((await prisma.mentorshipApplication.findUniqueOrThrow({ where: { id } })).bookingLinkSentAt).not.toBeNull();
  });
});

describe('settings', () => {
  it('owner can update validated settings; they override the site defaults', async () => {
    const owner = await makeAdmin('OWNER');
    await cmd.updateSettings(owner.actor, { contactEmail: 'support@surajmore.in', whatsappNumber: '919876543210' });
    const s = await getMergedSettings();
    expect(s.contact.email).toBe('support@surajmore.in');
    expect(s.contact.whatsappNumber).toBe('919876543210');
    await expect(cmd.updateSettings(owner.actor, { levelZeroJoinUrl: 'javascript:alert(1)' })).rejects.toThrow();
  });
});

describe('health check', () => {
  it('reports database and payment mode without secrets', async () => {
    process.env.CASHFREE_SECRET_KEY = 'super_secret_value';
    const res = await healthGET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ status: 'ok', database: 'ok', paymentMode: 'mock' });
    expect(JSON.stringify(body)).not.toContain('super_secret_value');
  });

  it('refuses live payments unless explicitly unlocked', async () => {
    process.env.CASHFREE_MODE = 'production';
    const res = await healthGET();
    expect(res.status).toBe(503);
    expect((await res.json()).paymentMode).toBe('misconfigured');
  });
});
