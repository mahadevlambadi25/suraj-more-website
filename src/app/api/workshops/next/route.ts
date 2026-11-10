import { NextResponse } from 'next/server';
import { getActiveCohort } from '@/lib/cms';
import { formatDateShort, formatInr, formatTime } from '@/lib/format';

// Never cached: the announcement banner calls this on in-site navigation so an already-open tab
// stops showing a workshop the moment it is closed/unpublished in /ops (the root layout itself is
// not re-rendered on client-side navigation).
export const dynamic = 'force-dynamic';

export async function GET() {
  const c = await getActiveCohort(); // fails safe → null
  const body = c
    ? {
        cohort: {
          title: c.title,
          href: `/workshop/${c.slug}`,
          startsAt: c.startsAt,
          dateLabel: formatDateShort(c.startsAt, c.timezone),
          timeLabel: formatTime(c.startsAt, c.timezone),
          priceLabel: formatInr(c.priceInr),
        },
      }
    : { cohort: null };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
