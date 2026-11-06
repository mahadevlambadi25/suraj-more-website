import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { POST as freeTrainingPOST } from '@/app/api/leads/free-training/route';
import { prisma } from '@/lib/db';
import { joinWaitlist, submitFreeTraining, submitMentorshipApplication } from '@/lib/forms';
import { CONSENT_WORDING, freeTrainingSchema, mentorshipSchema } from '@/lib/validation';

const valid = {
  name: 'Asha Rao',
  email: 'Asha@Test.in',
  phone: '+91 98765 43210',
  audienceType: 'coach' as const,
  whatsappConsent: true,
  marketingConsent: false,
};
const utm = { utm_source: 'instagram', utm_medium: 'reel', utm_campaign: 'nov-launch', referrer: 'https://instagram.com/', landingPage: '/free-training' };

function req(body: unknown, ip = '198.51.100.1') {
  return new NextRequest('https://test.example/api/leads/free-training', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

describe('free training form', () => {
  it('persists lead, registration, consent ledger and UTM', async () => {
    const { leadId } = await submitFreeTraining(freeTrainingSchema.parse(valid), utm);
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, include: { consents: true, freeTrainingRegistrations: true } });
    expect(lead.email).toBe('asha@test.in');
    expect(lead.source).toBe('FREE_TRAINING');
    expect([lead.utmSource, lead.utmMedium, lead.utmCampaign, lead.landingPage]).toEqual(['instagram', 'reel', 'nov-launch', '/free-training']);
    expect(lead.freeTrainingRegistrations[0].attribution).toMatchObject({ utm_campaign: 'nov-launch' });
    const marketing = lead.consents.find((c) => c.type === 'MARKETING')!;
    expect(marketing).toMatchObject({ granted: false, wording: CONSENT_WORDING.marketing, source: 'free-training-form' });
    expect(lead.consents.find((c) => c.type === 'WHATSAPP')?.granted).toBe(true);
    expect(marketing.createdAt).toBeInstanceOf(Date);
  });

  it('records follow-up messages honestly as NOT_CONFIGURED when no provider is set', async () => {
    await submitFreeTraining(freeTrainingSchema.parse(valid), utm);
    const events = await prisma.integrationEvent.findMany();
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.status === 'NOT_CONFIGURED')).toBe(true);
  });

  it('keeps one lead per email and first-touch UTM on repeat submissions', async () => {
    await submitFreeTraining(freeTrainingSchema.parse(valid), utm);
    await submitFreeTraining(freeTrainingSchema.parse({ ...valid, name: 'Asha R' }), { utm_source: 'google' });
    expect(await prisma.lead.count()).toBe(1);
    const lead = await prisma.lead.findFirstOrThrow();
    expect(lead.utmSource).toBe('instagram');
    expect(lead.name).toBe('Asha R');
    expect(await prisma.freeTrainingRegistration.count()).toBe(2);
  });

  it('API: valid submission → 200, access cookie set, data stored', async () => {
    const res = await freeTrainingPOST(req({ ...valid, startedAt: Date.now() - 5000, attribution: utm }));
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('sm_ft_access=1');
    expect(await prisma.lead.count()).toBe(1);
  });

  it('API: invalid data → 422 with field errors, nothing stored', async () => {
    const res = await freeTrainingPOST(req({ name: 'A', email: 'nope', phone: '1', startedAt: Date.now() - 5000 }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(Object.keys(json.errors)).toEqual(expect.arrayContaining(['name', 'email', 'phone', 'audienceType']));
    expect(await prisma.lead.count()).toBe(0);
  });

  it('API: honeypot and too-fast submissions get a fake success and are NOT stored', async () => {
    expect((await freeTrainingPOST(req({ ...valid, website_hp: 'http://spam', startedAt: Date.now() - 5000 }))).status).toBe(200);
    expect((await freeTrainingPOST(req({ ...valid, startedAt: Date.now() }, '198.51.100.2'))).status).toBe(200);
    expect(await prisma.lead.count()).toBe(0);
  });

  it('API: rate limits a single IP (6 per minute)', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await freeTrainingPOST(req({ ...valid, email: `u${i}@test.in`, startedAt: Date.now() - 5000 }, '198.51.100.9'))).status);
    expect(statuses.slice(0, 6).every((s) => s === 200)).toBe(true);
    expect(statuses[6]).toBe(429);
  });
});

describe('mentorship + waitlist', () => {
  it('stores applications with consent and attribution', async () => {
    const input = mentorshipSchema.parse({
      name: 'Ravi K',
      email: 'ravi@test.in',
      phone: '+91 99999 11111',
      link: 'ravi.in',
      offer: 'B2B consulting for SaaS founders',
      salesChallenge: 'Prospects stall after the discovery call',
      desiredOutcome: 'A repeatable call structure for my team',
      timeline: 'now',
      timezone: 'Asia/Kolkata',
      marketingConsent: true,
    });
    const { applicationId } = await submitMentorshipApplication(input, utm);
    const app = await prisma.mentorshipApplication.findUniqueOrThrow({ where: { id: applicationId }, include: { lead: { include: { consents: true } } } });
    expect(app.status).toBe('NEW');
    expect(app.revenueRange).toBeNull(); // not collected unless used for qualification
    expect(app.lead.consents[0]).toMatchObject({ type: 'MARKETING', granted: true });
    expect(app.attribution).toMatchObject({ utm_source: 'instagram' });
  });

  it('waitlist is idempotent per email + program', async () => {
    const a = await joinWaitlist({ name: 'Meena S', email: 'meena@test.in', programId: 'workshop', marketingConsent: false }, undefined);
    const b = await joinWaitlist({ name: 'Meena S', email: 'MEENA@test.in', programId: 'workshop', marketingConsent: false }, undefined);
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(await prisma.waitlistEntry.count()).toBe(1);
  });
});
