import { z } from 'zod';

// Admin cohort form → validated database values. All dates/times are entered in IST (Asia/Kolkata),
// which is the brief's operating timezone. Prices are entered in rupees and stored in paise.

const IST = '+05:30';
const dt = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Use the date picker (YYYY-MM-DD HH:mm)');
const rupees = (label: string) =>
  z.coerce.number({ invalid_type_error: `${label} must be a number` }).min(0, `${label} cannot be negative`).max(10_00_000, `${label} is too large`);

export const cohortFormSchema = z
  .object({
    slug: z.string().trim().regex(/^[a-z0-9-]{3,60}$/, 'Lowercase letters, digits and dashes (3–60 chars)'),
    title: z.string().trim().min(3).max(150),
    startsAt: dt,
    endsAt: dt,
    status: z.enum(['DRAFT', 'OPEN', 'CLOSED']),
    seatLimit: z.union([z.literal(''), z.coerce.number().int().min(1).max(100_000)]).optional(),
    priceRupees: rupees('Price').min(1, 'Price must be at least ₹1'),
    compareAtRupees: z.union([z.literal(''), rupees('Compare-at price')]).optional(),
    compareAtPriceVerified: z.boolean(),
    vipAddonActive: z.boolean(),
    vipAddonTitle: z.string().trim().max(100).default('Recording + VIP Pack'),
    vipAddonPriceRupees: z.union([z.literal(''), rupees('Add-on price')]).optional(),
    vipAddonIncludes: z.string().max(1000).default(''),
    sessions: z.string().trim().min(1, 'Add at least one session').max(5000),
    reminderCopy: z.string().max(1000).default(''),
    zoomJoinUrl: z.union([z.literal(''), z.string().trim().url().startsWith('https://', 'Must be an https:// link')]).optional(),
    zoomPasscode: z.string().trim().max(50).optional(),
  })
  .superRefine((v, ctx) => {
    if (new Date(v.endsAt + IST) <= new Date(v.startsAt + IST)) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'End must be after start' });
    if (v.vipAddonActive && !(Number(v.vipAddonPriceRupees) > 0)) ctx.addIssue({ code: 'custom', path: ['vipAddonPriceRupees'], message: 'Set an add-on price or turn the add-on off' });
    if (v.compareAtPriceVerified && !(Number(v.compareAtRupees) > 0)) ctx.addIssue({ code: 'custom', path: ['compareAtRupees'], message: 'A verified compare-at price needs a value' });
  });

export type CohortFormInput = z.infer<typeof cohortFormSchema>;

/**
 * Sessions: one per line, "Label | YYYY-MM-DD HH:mm | HH:mm | Topic" (end time on the same day, IST).
 *   Day 1 | 2026-12-12 11:00 | 14:00 | Intent — discovery
 */
export function parseSessions(text: string) {
  const out: { label: string; startsAt: string; endsAt: string; topic: string }[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const [i, line] of lines.entries()) {
    const [label, start, end, ...topic] = line.split('|').map((p) => p.trim());
    const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})$/.exec(start ?? '');
    if (!label || !m || !/^\d{2}:\d{2}$/.test(end ?? '') || topic.join('|').trim() === '') {
      throw new Error(`Session line ${i + 1} must look like "Day 1 | 2026-12-12 11:00 | 14:00 | Topic"`);
    }
    const startsAt = new Date(`${m[1]}T${m[2]}:00${IST}`);
    const endsAt = new Date(`${m[1]}T${end}:00${IST}`);
    if (endsAt <= startsAt) throw new Error(`Session line ${i + 1}: end time must be after start time`);
    out.push({ label, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), topic: topic.join('|').trim() });
  }
  return out;
}

export function sessionsToText(sessions: { label: string; startsAt: string; endsAt: string; topic: string }[]) {
  return sessions.map((s) => `${s.label} | ${toIstInput(new Date(s.startsAt)).replace('T', ' ')} | ${toIstInput(new Date(s.endsAt)).slice(11)} | ${s.topic}`).join('\n');
}

/** Date → "YYYY-MM-DDTHH:mm" in IST, for <input type="datetime-local">. */
export function toIstInput(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function cohortFormToData(v: CohortFormInput) {
  const toPaise = (r: unknown) => (r === '' || r == null ? null : Math.round(Number(r) * 100));
  return {
    title: v.title,
    startsAt: new Date(v.startsAt + `:00${IST}`),
    endsAt: new Date(v.endsAt + `:00${IST}`),
    timezone: 'Asia/Kolkata',
    status: v.status,
    seatLimit: v.seatLimit === '' || v.seatLimit == null ? null : Number(v.seatLimit),
    pricePaise: Math.round(v.priceRupees * 100),
    compareAtPricePaise: toPaise(v.compareAtRupees),
    compareAtPriceVerified: v.compareAtPriceVerified,
    vipAddonActive: v.vipAddonActive,
    vipAddonTitle: v.vipAddonTitle || 'Recording + VIP Pack',
    vipAddonPricePaise: toPaise(v.vipAddonPriceRupees) ?? 0,
    vipAddonIncludes: v.vipAddonIncludes.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
    sessions: parseSessions(v.sessions),
    reminderCopy: v.reminderCopy,
    zoomJoinUrl: v.zoomJoinUrl || null,
    zoomPasscode: v.zoomPasscode || null,
  };
}
