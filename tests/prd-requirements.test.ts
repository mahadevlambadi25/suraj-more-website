// Tests for the PRD requirements implemented in this change (section numbers refer to the developer brief).
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import * as cmd from '@/lib/admin/commands';
import { getProgram, getPrograms, getPublishedCaseStudies, getPublishedTestimonials, getUpcomingCohorts } from '@/lib/cms';
import { prisma } from '@/lib/db';
import { checkExternalLinks, sendWorkshopReminders } from '@/lib/jobs';
import { createWorkshopOrder, handleCashfreeEvent } from '@/lib/orders';
import { personSchema } from '@/lib/seo';
import { getMergedSettings } from '@/lib/settings';
import { OfferLadder } from '@/components/Sections';
import { VideoPlayer } from '@/components/VideoPlayer';
import { WorkshopAbout } from '@/components/Workshop';
import { buyer, DAY, makeAdmin, makeCohort, successEvent } from './helpers';

const MOCK = { provider: 'MOCK' as const, signatureVerified: false };
const html = <P extends object>(el: ComponentType<P>, props: P) => renderToStaticMarkup(createElement(el, props));

describe('§7.2 workshop content', () => {
  it('Day 1 / Day 2 follow the PRD and an "Included" list is shown', async () => {
    const program = await getProgram('workshop');
    expect(program.curriculum[0]).toMatch(/Day 1: The One Skill, the Sales Arm Framework and the role of the coach/);
    expect(program.curriculum[1]).toMatch(/Day 2: The Doctor Frame and the C3 Certainty Reframe/);
    expect(program.curriculum.join(' ')).not.toMatch(/Q&A/); // live Q&A belongs to the paid VIP add-on (PRD §3.2)
    const out = html(WorkshopAbout, { program });
    expect(out).toContain('What’s included');
    expect(out).toContain('A live seat for both days on Zoom');
    expect(out).toContain('Sales scripts');
  });
});

describe('§7.1 program cards show who it is for and the format', () => {
  it('every ladder card has a For and Format line', async () => {
    const out = html(OfferLadder, { programs: await getPrograms(), cohorts: await getUpcomingCohorts() });
    expect(out.match(/<dt>For<\/dt>/g)).toHaveLength(3);
    expect(out.match(/<dt>Format<\/dt>/g)).toHaveLength(3);
    expect(out).toContain('2-day live workshop on Zoom');
    expect(out).toContain('Consultants, agency owners and established coaches with a high-ticket offer');
  });
});

describe('§5.2 / §12.2 social profile links', () => {
  it('owner saves profile links; they feed the footer list and Person schema', async () => {
    const owner = await makeAdmin('OWNER');
    await cmd.updateSettings(owner.actor, { instagramUrl: 'https://www.instagram.com/sales_system_builder/', linkedinUrl: 'https://www.linkedin.com/in/suraj-m-3334b3157/', youtubeUrl: '' });
    const s = await getMergedSettings();
    expect(s.socials).toEqual([
      { label: 'Instagram', href: 'https://www.instagram.com/sales_system_builder/' },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/suraj-m-3334b3157/' },
    ]);
    expect(personSchema(s.socials).sameAs).toEqual(s.socials.map((x) => x.href));
  });

  it('rejects links to the wrong site or without https', async () => {
    const owner = await makeAdmin('OWNER');
    await expect(cmd.updateSettings(owner.actor, { instagramUrl: 'https://example.com/me' })).rejects.toThrow(/valid Instagram profile/);
    await expect(cmd.updateSettings(owner.actor, { linkedinUrl: 'http://linkedin.com/in/x' })).rejects.toThrow(/https/);
    expect((await getMergedSettings()).socials).toEqual([]);
  });
});

describe('§11.1 / §9.4 free-training video captions and transcript', () => {
  it('saved transcript and captions reach the player', async () => {
    const owner = await makeAdmin('OWNER');
    await cmd.updateSettings(owner.actor, { freeTrainingVideoUrl: 'https://youtu.be/dQw4w9WgXcQ', freeTrainingVideoCaptions: 'on', freeTrainingVideoTranscript: 'First paragraph.\n\nSecond paragraph.' });
    const video = (await getMergedSettings()).freeTraining.video!;
    expect(video).toMatchObject({ captions: true, transcript: 'First paragraph.\n\nSecond paragraph.' });
    const out = html(VideoPlayer, { video, label: 'Play' });
    expect(out).toContain('Read the transcript');
    expect(out).toContain('Second paragraph.');
    await expect(cmd.updateSettings(owner.actor, { freeTrainingVideoCaptions: 'maybe' })).rejects.toThrow(/on or off/);
  });

  it('transcript typed in a browser (CRLF line breaks) still splits into paragraphs', async () => {
    const owner = await makeAdmin('OWNER');
    await cmd.updateSettings(owner.actor, { freeTrainingVideoUrl: 'https://youtu.be/dQw4w9WgXcQ', freeTrainingVideoTranscript: 'Para one.\r\n\r\nPara two.' });
    const video = (await getMergedSettings()).freeTraining.video!;
    expect(video.transcript).toBe('Para one.\n\nPara two.');
    expect(html(VideoPlayer, { video }).match(/<p>Para (one|two)\.<\/p>/g)).toHaveLength(2);
  });
});

describe('§13.2 / §13.3 monitoring', () => {
  const post = async (body: unknown, ip = '203.0.113.7') => {
    const { POST } = await import('@/app/api/monitor/route');
    return POST(new NextRequest('https://test.example/api/monitor', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'x-forwarded-for': ip } }));
  };

  it('records 404s and page errors as ops alerts — path only, never the query string', async () => {
    expect((await post({ type: 'not_found', path: '/old-page?email=a@b.c&token=x', referrer: 'https://google.com/search?q=secret' })).status).toBe(200);
    expect((await post({ type: 'client_error', path: '/workshop/x', digest: 'abc123' })).status).toBe(200);
    const alerts = await prisma.integrationEvent.findMany({ where: { channel: 'OPS_ALERT' }, orderBy: { createdAt: 'asc' } });
    expect(alerts.map((a) => (a.payload as { message: string }).message)).toEqual(['Page not found (404): /old-page', 'Page error on /workshop/x']);
    expect(JSON.stringify(alerts)).not.toMatch(/token=|email=|secret/);
  });

  it('rejects malformed reports and rate-limits floods', async () => {
    expect((await post({ type: 'nope', path: '/x' })).status).toBe(400);
    for (let i = 0; i < 12; i++) await post({ type: 'not_found', path: `/probe-${i}` }, '198.51.100.9');
    expect(await prisma.integrationEvent.count({ where: { channel: 'OPS_ALERT' } })).toBe(10);
  });

  it('daily link check alerts on broken external links but not on sites that block bots', async () => {
    const owner = await makeAdmin('OWNER');
    await cmd.updateSettings(owner.actor, { levelZeroJoinUrl: 'https://whop.com/broken-course', linkedinUrl: 'https://www.linkedin.com/in/someone/' });
    // LinkedIn answers bots with HTTP 999 (not representable by the Response constructor, so a plain object is used).
    const fakeFetch = vi.fn(async (url: string | URL | Request) => ({ status: String(url).includes('linkedin') ? 999 : 404 }) as Response);
    const r = await checkExternalLinks(fakeFetch as unknown as typeof fetch);
    expect(r.broken.map((b) => b.name)).toEqual(['Level Zero (Whop) join link']);
    expect(await prisma.integrationEvent.count({ where: { channel: 'OPS_ALERT' } })).toBe(1);
  });
});

describe('§10.1 / §11.3 workshop reminders', () => {
  async function paidRegistration(startsInDays: number, email: string) {
    const start = new Date(Date.now() + startsInDays * DAY);
    const cohort = await makeCohort({ startsAt: start, endsAt: new Date(start.getTime() + DAY) });
    const o = await createWorkshopOrder(buyer({ cohortId: cohort.id, email }), undefined);
    await handleCashfreeEvent(successEvent(o.orderId, 47), `pay-${email}`, MOCK);
    return cohort;
  }

  it('reminds paid attendees once, only when the workshop is near; unconfigured channels are retried', async () => {
    await paidRegistration(1, 'soon@test.in'); // within the window
    await paidRegistration(5, 'later@test.in'); // too early
    const unpaidCohort = await makeCohort({ startsAt: new Date(Date.now() + DAY), endsAt: new Date(Date.now() + 2 * DAY) });
    await createWorkshopOrder(buyer({ cohortId: unpaidCohort.id, email: 'unpaid@test.in' }), undefined);

    // No provider configured: attempt is recorded honestly, not marked as sent.
    expect(await sendWorkshopReminders()).toEqual({ due: 1, sent: 0, pending: 1 });
    expect(await prisma.integrationEvent.count({ where: { template: 'workshop_reminder', status: 'NOT_CONFIGURED' } })).toBe(2);

    // Provider configured: delivered once, then never again.
    process.env.EMAIL_WEBHOOK_URL = 'https://hooks.test/email';
    process.env.WHATSAPP_WEBHOOK_URL = 'https://hooks.test/wa';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
    expect(await sendWorkshopReminders()).toEqual({ due: 1, sent: 1, pending: 0 });
    expect(await sendWorkshopReminders()).toEqual({ due: 0, sent: 0, pending: 0 });
    const reg = await prisma.workshopRegistration.findFirstOrThrow({ where: { email: 'soon@test.in' } });
    expect(reg.reminderSentAt).not.toBeNull();
    const ledger = await prisma.integrationEvent.findMany({ where: { template: 'workshop_reminder' } });
    expect(JSON.stringify(ledger)).not.toContain('zoom.us'); // the Zoom link is sent but never stored in the ledger
  });

  it('cron endpoint refuses without CRON_SECRET, rejects a wrong token, runs with the right one', async () => {
    const { GET } = await import('@/app/api/cron/daily/route');
    const req = (auth?: string) => new NextRequest('https://test.example/api/cron/daily', { headers: auth ? { authorization: auth } : {} });
    delete process.env.CRON_SECRET;
    expect((await GET(req('Bearer anything'))).status).toBe(503);
    process.env.CRON_SECRET = 'cron-secret-for-tests';
    expect((await GET(req('Bearer wrong'))).status).toBe(401);
    expect((await GET(req())).status).toBe(401);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 200 })));
    const ok = await GET(req('Bearer cron-secret-for-tests'));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true, reminders: { due: 0 }, links: { broken: [] } });
  });
});

describe('§11.2 / §11.5 proof managed in /ops', () => {
  const testimonial = (o: Record<string, unknown> = {}) => ({
    client: 'Asha Rao', role: 'Founder', niche: 'Fitness coach', quote: 'The Doctor Frame changed how I run discovery calls.', videoUrl: '', verifiedOutcome: '',
    verification: 'CLIENT_REPORTED', status: 'DRAFT', sortOrder: '0', permissionOnFile: false, ...o,
  });

  it('drafts stay private; publishing requires permission on file; published items appear publicly', async () => {
    const admin = await makeAdmin('ADMIN');
    const t = await cmd.saveTestimonial(admin.actor, null, testimonial());
    expect(await getPublishedTestimonials()).toEqual([]);

    await expect(cmd.saveTestimonial(admin.actor, t.id, testimonial({ status: 'PUBLISHED' }))).rejects.toThrow(/permission/);
    await cmd.saveTestimonial(admin.actor, t.id, testimonial({ status: 'PUBLISHED', permissionOnFile: true, videoUrl: 'https://youtu.be/dQw4w9WgXcQ' }));
    const pub = await getPublishedTestimonials();
    expect(pub).toHaveLength(1);
    expect(pub[0]).toMatchObject({ client: 'Asha Rao', verification: 'client-reported', video: { provider: 'youtube', id: 'dQw4w9WgXcQ' } });
    expect(await prisma.auditLog.count({ where: { action: { in: ['testimonial.create', 'testimonial.update'] } } })).toBe(2);

    await cmd.deleteTestimonial(admin.actor, t.id);
    expect(await getPublishedTestimonials()).toEqual([]);
  });

  it('validates content: quote or video required, video must be YouTube/Vimeo', async () => {
    const admin = await makeAdmin('ADMIN');
    await expect(cmd.saveTestimonial(admin.actor, null, testimonial({ quote: '' }))).rejects.toThrow(/quote or a video/);
    await expect(cmd.saveTestimonial(admin.actor, null, testimonial({ videoUrl: 'https://example.com/v.mp4' }))).rejects.toThrow(/YouTube or Vimeo/);
  });

  it('case studies carry baseline, period and source (PRD §8.2) and follow the same publishing rule', async () => {
    const admin = await makeAdmin('ADMIN');
    const form = {
      client: 'Rahul Mehta', role: 'Agency owner', startingPoint: 'Calls stalled after discovery.', intervention: 'Doctor Frame + C3 Certainty Reframe.',
      outcomeMetric: 'Close rate on qualified calls', outcomeBaseline: '12%', outcomeResult: '21%', outcomePeriod: '90 days', outcomeSource: 'Client CRM export',
      caveat: 'Results vary and are not guaranteed.', videoUrl: '', verification: 'INDEPENDENTLY_VERIFIED', status: 'PUBLISHED', sortOrder: '1', permissionOnFile: true,
    };
    await expect(cmd.saveCaseStudy(admin.actor, null, { ...form, outcomeSource: '' })).rejects.toThrow(/Source/);
    await cmd.saveCaseStudy(admin.actor, null, form);
    const [c] = await getPublishedCaseStudies();
    expect(c).toMatchObject({ client: 'Rahul Mehta', verification: 'independently-verified', outcome: { baseline: '12%', result: '21%', period: '90 days', source: 'Client CRM export' } });
  });

  it('only ADMIN and above can change proof', async () => {
    const viewer = await makeAdmin('VIEWER');
    await expect(cmd.saveTestimonial(viewer.actor, null, testimonial())).rejects.toThrow(/permission/);
    expect(await prisma.testimonial.count()).toBe(0);
  });
});
