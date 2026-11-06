// Seeds reference data. Safe to run repeatedly (upserts by slug).
//   npm run db:seed
// The SAMPLE cohort is only seeded outside production unless SEED_SAMPLE_DATA=true.
// It is flagged isSample and is hidden from the public site in production automatically.
import { PrismaClient } from '@prisma/client';
import { cohorts } from '../src/content/cohorts';

const prisma = new PrismaClient();

async function main() {
  const allowSample = process.env.SEED_SAMPLE_DATA === 'true' || (process.env.NODE_ENV !== 'production' && process.env.SEED_SAMPLE_DATA !== 'false');
  for (const c of cohorts) {
    if (c.sample && !allowSample) {
      console.log(`skip sample cohort ${c.id}`);
      continue;
    }
    const data = {
      title: c.title,
      startsAt: new Date(c.startsAt),
      endsAt: new Date(c.endsAt),
      timezone: c.timezone,
      status: c.status.toUpperCase() as 'DRAFT' | 'OPEN' | 'CLOSED',
      seatLimit: c.seatLimit,
      pricePaise: Math.round(c.priceInr * 100),
      compareAtPricePaise: c.compareAtPriceInr != null ? Math.round(c.compareAtPriceInr * 100) : null,
      compareAtPriceVerified: c.compareAtPriceVerified,
      vipAddonActive: c.vipAddon.active,
      vipAddonTitle: c.vipAddon.title,
      vipAddonPricePaise: Math.round(c.vipAddon.priceInr * 100),
      vipAddonIncludes: c.vipAddon.includes,
      sessions: JSON.parse(JSON.stringify(c.sessions)),
      reminderCopy: c.reminderCopy,
      // Placeholder attendee link for the SAMPLE cohort only. Real links are set per cohort in /ops → Workshops.
      zoomJoinUrl: c.sample ? 'https://zoom.us/j/0000000000' : null,
      isSample: !!c.sample,
    };
    // Seed creates; it never overwrites a cohort an admin has since edited.
    const existing = await prisma.workshopCohort.findUnique({ where: { slug: c.id } });
    if (existing) {
      console.log(`cohort ${c.id} exists — left unchanged`);
    } else {
      await prisma.workshopCohort.create({ data: { slug: c.id, ...data } });
      console.log(`cohort ${c.id} created`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
