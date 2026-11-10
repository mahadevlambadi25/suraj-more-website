import { describe, expect, it, vi } from 'vitest';
import * as cmd from '@/lib/admin/commands';
import { cohortFormSchema, toIstInput } from '@/lib/admin/cohort-form';
import { getActiveCohort, getCohortPage, getPrograms, getUpcomingCohorts } from '@/lib/cms';
import { prisma } from '@/lib/db';
import { createWorkshopOrder, getOrderStatus } from '@/lib/orders';
import { buyer, DAY, makeAdmin, makeCohort } from './helpers';

describe('public workshop listing (dynamic, from /ops cohorts)', () => {
  it('lists every OPEN upcoming cohort, soonest first, and nothing else', async () => {
    const later = await makeCohort({ slug: 'later', startsAt: new Date(Date.now() + 30 * DAY), endsAt: new Date(Date.now() + 31 * DAY) });
    const sooner = await makeCohort({ slug: 'sooner', startsAt: new Date(Date.now() + 5 * DAY), endsAt: new Date(Date.now() + 6 * DAY) });
    const third = await makeCohort({ slug: 'third', startsAt: new Date(Date.now() + 15 * DAY), endsAt: new Date(Date.now() + 16 * DAY) });
    await makeCohort({ slug: 'a-draft', status: 'DRAFT' });
    await makeCohort({ slug: 'a-closed', status: 'CLOSED' });
    await makeCohort({ slug: 'already-started', startsAt: new Date(Date.now() - DAY), endsAt: new Date(Date.now() + DAY) });

    const list = await getUpcomingCohorts();
    expect(list.map((c) => c.slug)).toEqual([sooner.slug, third.slug, later.slug]);
    expect((await getActiveCohort())?.slug).toBe(sooner.slug); // strip / ladder use the soonest
    expect(JSON.stringify(list)).not.toContain('zoom'); // private delivery never reaches the public layer
  });

  it('hides sample cohorts in production', async () => {
    await makeCohort({ slug: 'sample-one', isSample: true });
    vi.stubEnv('NODE_ENV', 'production');
    try {
      expect(await getUpcomingCohorts()).toEqual([]);
      expect(await getCohortPage('sample-one')).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('reports live seat availability and sold-out state', async () => {
    const c = await makeCohort({ slug: 'two-seats', seatLimit: 2 });
    expect((await getUpcomingCohorts())[0]).toMatchObject({ seatsLeft: 2, soldOut: false });
    await createWorkshopOrder(buyer({ cohortId: c.id }), undefined);
    await createWorkshopOrder(buyer({ cohortId: c.id, email: 'second@test.in' }), undefined);
    expect((await getUpcomingCohorts())[0]).toMatchObject({ seatsLeft: 0, soldOut: true });
    expect((await getCohortPage('two-seats'))?.state).toBe('sold_out');
  });

  it('shows "From" pricing on the offer ladder when open dates have different prices', async () => {
    await makeCohort({ slug: 'p47' });
    expect((await getPrograms()).find((p) => p.id === 'workshop')?.priceLabel).toBe('₹47');
    await makeCohort({ slug: 'p99', pricePaise: 9900 });
    expect((await getPrograms()).find((p) => p.id === 'workshop')?.priceLabel).toBe('From ₹47');
  });
});

describe('workshop detail pages', () => {
  it('open / closed / started / draft / unknown', async () => {
    await makeCohort({ slug: 'is-open' });
    await makeCohort({ slug: 'is-closed', status: 'CLOSED' });
    await makeCohort({ slug: 'has-started', startsAt: new Date(Date.now() - DAY), endsAt: new Date(Date.now() + DAY) });
    await makeCohort({ slug: 'is-draft', status: 'DRAFT' });

    expect((await getCohortPage('is-open'))?.state).toBe('open');
    expect((await getCohortPage('is-closed'))?.state).toBe('closed');
    expect((await getCohortPage('has-started'))?.state).toBe('closed');
    expect(await getCohortPage('is-draft')).toBeNull();
    expect(await getCohortPage('does-not-exist')).toBeNull();
    expect(await getCohortPage('../etc')).toBeNull();
  });

  it('reflects admin edits immediately and unpublishing removes it from the list', async () => {
    const admin = await makeAdmin('ADMIN');
    const form = (o: Record<string, unknown> = {}) => ({
      slug: 'edit-me', title: 'Original title', startsAt: toIstInput(new Date(Date.now() + 20 * DAY)), endsAt: toIstInput(new Date(Date.now() + 21 * DAY)),
      status: 'OPEN', seatLimit: '', priceRupees: '47',
      compareAtRupees: '', compareAtPriceVerified: false, vipAddonActive: true, vipAddonTitle: 'Recording + VIP Pack', vipAddonPriceRupees: '499',
      vipAddonIncludes: 'Workbook', sessions: 'Day 1 | 2027-02-06 11:00 | 14:00 | Intent\nDay 2 | 2027-02-07 11:00 | 14:00 | Close', reminderCopy: '',
      zoomJoinUrl: 'https://zoom.us/j/1', zoomPasscode: '', ...o,
    });
    const c = await cmd.saveCohort(admin.actor, null, form());
    expect((await getCohortPage('edit-me'))?.cohort).toMatchObject({ title: 'Original title', priceInr: 47 });

    await cmd.saveCohort(admin.actor, c.id, form({ title: 'New title', priceRupees: '97' }));
    expect((await getCohortPage('edit-me'))?.cohort).toMatchObject({ title: 'New title', priceInr: 97 });
    expect((await getUpcomingCohorts())[0]).toMatchObject({ title: 'New title', priceInr: 97 });

    await cmd.saveCohort(admin.actor, c.id, form({ status: 'DRAFT' }));
    expect(await getUpcomingCohorts()).toEqual([]);
    expect(await getCohortPage('edit-me')).toBeNull();
  });

  it('each workshop checks out against its own price and VIP add-on', async () => {
    const a = await makeCohort({ slug: 'cohort-a', pricePaise: 4700, vipAddonPricePaise: 49900 });
    const b = await makeCohort({ slug: 'cohort-b', pricePaise: 9900, vipAddonPricePaise: 29900 });
    const oa = await createWorkshopOrder(buyer({ cohortId: a.id, vipAddon: true }), undefined);
    const ob = await createWorkshopOrder(buyer({ cohortId: b.id, vipAddon: true, email: 'b@test.in' }), undefined);
    expect((await prisma.order.findUnique({ where: { orderNumber: oa.orderId } }))?.amountPaise).toBe(54600);
    expect((await prisma.order.findUnique({ where: { orderNumber: ob.orderId } }))?.amountPaise).toBe(39800);
    // The confirmation / retry page knows which workshop the order belongs to.
    expect((await getOrderStatus(ob.orderId, false))?.cohort).toMatchObject({ id: b.id, slug: 'cohort-b' });
  });

  it('banner endpoint always reflects the current next workshop and is never cached', async () => {
    const { GET } = await import('@/app/api/workshops/next/route');
    const soon = await makeCohort({ slug: 'banner-soon', title: 'Soon', startsAt: new Date(Date.now() + 3 * DAY), endsAt: new Date(Date.now() + 4 * DAY) });
    await makeCohort({ slug: 'banner-later', title: 'Later', startsAt: new Date(Date.now() + 9 * DAY), endsAt: new Date(Date.now() + 10 * DAY) });

    let res = await GET();
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
    expect((await res.json()).cohort).toMatchObject({ title: 'Soon', href: '/workshop/banner-soon' });

    // Closing the soonest one in /ops moves the banner to the next open workshop…
    await prisma.workshopCohort.update({ where: { id: soon.id }, data: { status: 'CLOSED' } });
    res = await GET();
    expect((await res.json()).cohort).toMatchObject({ title: 'Later', href: '/workshop/banner-later' });

    // …and with nothing open, the banner disappears.
    await prisma.workshopCohort.updateMany({ data: { status: 'CLOSED' } });
    expect((await (await GET()).json()).cohort).toBeNull();
  });

  it('a CLOSED workshop cannot be booked even if its checkout form was already open', async () => {
    const c = await makeCohort({ slug: 'closing-now' });
    await prisma.workshopCohort.update({ where: { id: c.id }, data: { status: 'CLOSED' } });
    await expect(createWorkshopOrder(buyer({ cohortId: c.id }), undefined)).rejects.toMatchObject({ code: 'COHORT_CLOSED' });
    expect(await prisma.order.count({ where: { cohortId: c.id } })).toBe(0); // nothing created, no payment session
    expect((await getCohortPage('closing-now'))?.state).toBe('closed');
    expect(await getUpcomingCohorts()).toEqual([]);
  });

  it('rejects slugs that would collide with existing /workshop routes', () => {
    for (const slug of ['confirmation', 'checkout-mock']) {
      expect(cohortFormSchema.safeParse({ slug }).error?.issues.some((i) => i.path[0] === 'slug' && /reserved/.test(i.message))).toBe(true);
    }
  });
});
