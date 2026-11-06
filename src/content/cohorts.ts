import type { Cohort } from '@/lib/types';

// SEED SOURCE ONLY. Live cohorts are stored in PostgreSQL and managed in /ops → Workshops.
// `npm run db:seed` creates these if missing; it never overwrites a cohort edited in the dashboard.
// Cohorts are the ONLY source of workshop dates — never hard-code dates in pages (brief §7).
// Expired cohorts are hidden and blocked from purchase automatically.
// `sample: true` entries are ignored in production builds.
export const cohorts: Omit<Cohort, 'slug'>[] = [
  {
    id: 'osw-sample-01',
    programId: 'workshop',
    title: 'The One Skill Workshop — Sample Cohort',
    startsAt: '2026-12-12T11:00:00+05:30',
    endsAt: '2026-12-13T14:00:00+05:30',
    timezone: 'Asia/Kolkata',
    status: 'open',
    seatLimit: null, // set only if a real limit applies
    priceInr: 47,
    compareAtPriceInr: 999,
    compareAtPriceVerified: false, // TODO issue #5: hidden until ₹999 is confirmed as a real price
    vipAddon: {
      active: true,
      priceInr: 499,
      title: 'Recording + VIP Pack',
      includes: ['Extra VIP day', 'Live Q&A', 'Workbook', '1-year recording access'],
    },
    sessions: [
      {
        label: 'Day 1',
        startsAt: '2026-12-12T11:00:00+05:30',
        endsAt: '2026-12-12T14:00:00+05:30',
        topic: 'Intent — discovery that earns the right to make an offer',
      },
      {
        label: 'Day 2',
        startsAt: '2026-12-13T11:00:00+05:30',
        endsAt: '2026-12-13T14:00:00+05:30',
        topic: 'Certainty → Close — handling hesitation without pressure',
      },
    ],
    reminderCopy: 'Your One Skill Workshop starts soon. Join 5 minutes early from a laptop if you can.',
    sample: true,
  },
];
