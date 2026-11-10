import 'server-only';
// Scheduled jobs, run once a day by /api/cron/daily (Vercel Cron). Each job is idempotent and safe to re-run.
import { sessionsSchema } from './cohorts';
import { prisma } from './db';
import { formatDate, formatTime } from './format';
import { alertOps, sendMessage } from './integrations';
import { safeError } from './security';
import { getMentorshipBookingUrl, getMergedSettings } from './settings';

const HOUR = 3_600_000;
/** A daily run reminds everyone whose workshop starts within this window (so every start time is covered once). */
export const REMINDER_WINDOW_MS = 36 * HOUR;

/**
 * PRD §10.1 / §11.3 / §11.4.5: transactional reminder (with the Zoom joining details) to every paid, confirmed
 * attendee before the workshop starts. Sent at most once per registration: `reminderSentAt` is set only when every
 * channel accepted the message; NOT_CONFIGURED/FAILED attempts are recorded in the ledger and retried next run.
 */
export async function sendWorkshopReminders(now = Date.now()) {
  const due = await prisma.workshopRegistration.findMany({
    where: {
      status: 'CONFIRMED',
      reminderSentAt: null,
      order: { status: 'PAID' },
      cohort: { startsAt: { gt: new Date(now), lte: new Date(now + REMINDER_WINDOW_MS) } },
    },
    include: { cohort: true },
    take: 500,
  });

  let sent = 0;
  let pending = 0;
  for (const r of due) {
    const c = r.cohort;
    const sessions = sessionsSchema.safeParse(c.sessions);
    const schedule = (sessions.success ? sessions.data : []).map((s) => `${s.label}: ${formatDate(s.startsAt, c.timezone)}, ${formatTime(s.startsAt, c.timezone)}`);
    const data = {
      name: r.name,
      cohort: c.title,
      startsAt: `${formatDate(c.startsAt.toISOString(), c.timezone)}, ${formatTime(c.startsAt.toISOString(), c.timezone)}`,
      schedule,
      timezone: c.timezone,
      reminderCopy: c.reminderCopy,
      zoomJoinUrl: c.zoomJoinUrl, // stripped from the ledger by deliver()
      zoomPasscode: c.zoomPasscode,
    };
    const related = { relatedType: 'registration', relatedId: r.id };
    try {
      const statuses = [
        await sendMessage({ kind: 'transactional', channel: 'email', template: 'workshop_reminder', to: r.email, data, ...related }),
        await sendMessage({ kind: 'transactional', channel: 'whatsapp', template: 'workshop_reminder', to: r.phone, data, ...related }),
      ];
      if (statuses.every((s) => s === 'SENT')) {
        // Compare-and-set: concurrent runs never double-mark (and never double-count) a registration.
        const upd = await prisma.workshopRegistration.updateMany({ where: { id: r.id, reminderSentAt: null }, data: { reminderSentAt: new Date(now) } });
        if (upd.count) sent++;
      } else {
        pending++;
      }
    } catch (err) {
      pending++;
      await alertOps('Workshop reminder could not be sent', { registrationId: r.id, error: safeError(err) });
    }
  }
  return { due: due.length, sent, pending };
}

/** Status codes that mean "the site blocks automated checks", not "the link is broken" (e.g. LinkedIn's 999). */
const UNVERIFIABLE = new Set([401, 403, 405, 429, 999]);

/**
 * PRD §13.3 "monitor … broken external links": checks the outbound links the site depends on
 * (Level Zero / Whop, mentorship booking link, social profiles). Broken ones raise an ops alert.
 */
export async function checkExternalLinks(fetchImpl: typeof fetch = fetch) {
  const s = await getMergedSettings();
  const booking = await getMentorshipBookingUrl();
  const links = [
    { name: 'Level Zero (Whop) join link', url: s.levelZero.joinUrl },
    ...(booking ? [{ name: 'Mentorship booking link', url: booking }] : []),
    ...s.socials.map((x) => ({ name: `${x.label} profile`, url: x.href })),
  ].filter((l) => /^https:\/\//.test(l.url));

  const broken: { name: string; url: string; problem: string }[] = [];
  for (const l of links) {
    try {
      const res = await fetchImpl(l.url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteLinkCheck/1.0)' } });
      if (res.status >= 400 && !UNVERIFIABLE.has(res.status)) broken.push({ ...l, problem: `HTTP ${res.status}` });
    } catch (err) {
      broken.push({ ...l, problem: safeError(err) });
    }
  }
  for (const b of broken) await alertOps(`External link broken: ${b.name}`, b);
  return { checked: links.length, broken };
}
