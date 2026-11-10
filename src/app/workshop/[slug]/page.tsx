import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { Countdown } from '@/components/Countdown';
import { WaitlistForm } from '@/components/forms/WaitlistForm';
import { WorkshopCheckoutForm } from '@/components/forms/WorkshopCheckoutForm';
import { ArrowRight } from '@/components/Icons';
import { MobileStickyCta } from '@/components/MobileStickyCta';
import { JsonLd, PageHero, Schedule } from '@/components/Sections';
import { TrackedLink } from '@/components/TrackedLink';
import { cohortDateRange, seatsLabel, WorkshopAbout, WorkshopFrameworksAndFaq } from '@/components/Workshop';
import { getCohortPage, getFaqs, getFrameworks, getProgram } from '@/lib/cms';
import { formatDate, formatInr, formatTime } from '@/lib/format';
import { pageMeta, workshopSchemas } from '@/lib/seo';

// Shows live workshop availability: always rendered fresh, so a cohort closed in /ops disappears on the very
// next visit or in-site navigation (static pages would be reused from the browser's router cache for minutes).
export const dynamic = 'force-dynamic';

// One database read per request, shared by generateMetadata and the page.
const loadCohortPage = cache((slug: string) => getCohortPage(slug));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadCohortPage(slug);
  if (!page) return { title: 'Workshop not found', robots: { index: false, follow: false } };
  const { cohort, state } = page;
  return pageMeta({
    title: `${cohort.title} · ${formatDate(cohort.startsAt, cohort.timezone)} | Suraj More`,
    absoluteTitle: true,
    description: `Live on Zoom, ${cohortDateRange(cohort)}. ${formatInr(cohort.priceInr)}. A live workshop on leading sales conversations with certainty instead of pressure.`,
    path: `/workshop/${cohort.slug}`,
    noindex: state === 'closed',
  });
}

export default async function WorkshopCohortPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [page, program, frameworks, faqs] = await Promise.all([loadCohortPage(slug), getProgram('workshop'), getFrameworks(), getFaqs()]);
  if (!page) notFound();
  const { cohort, state } = page;
  const open = state === 'open';
  const seats = seatsLabel(cohort);
  const eyebrow =
    state === 'closed' ? 'Registration closed' : `Live on Zoom · ${formatDate(cohort.startsAt, cohort.timezone)}${state === 'sold_out' ? ' · Sold out' : ''}`;

  return (
    <>
      {state !== 'closed' && <JsonLd data={workshopSchemas(cohort, state === 'sold_out')} />}
      <PageHero eyebrow={eyebrow} title={cohort.title} lead={program.summary}>
        {open ? (
          <>
            <div className="btn-row" style={{ marginBottom: 12 }}>
              <TrackedLink href="#register" className="btn btn--primary btn--lg" cta="workshop_hero" placement="hero">
                Reserve Your Seat · {formatInr(cohort.priceInr)} <ArrowRight />
              </TrackedLink>
            </div>
            {/* The anchor price is shown ONLY when marked as a verified real past price. */}
            <p className="small" style={{ color: '#c4cbd5', marginBottom: 28 }}>
              {cohort.compareAtPriceVerified && cohort.compareAtPriceInr ? (
                <>
                  <span className="compare" style={{ color: '#8e98a7' }}>Regular {formatInr(cohort.compareAtPriceInr)}</span>
                  {formatInr(cohort.priceInr)}
                </>
              ) : (
                formatInr(cohort.priceInr)
              )}{' '}
              · Live on Zoom{seats ? ` · ${seats}` : ''}
            </p>
            <p className="small" style={{ color: '#8e98a7', marginBottom: 10 }}>Starts in</p>
            <Countdown to={cohort.startsAt} />
          </>
        ) : (
          <div className="btn-row">
            <Link href="/workshop" className="btn btn--primary btn--lg">
              See Upcoming Dates <ArrowRight />
            </Link>
          </div>
        )}
      </PageHero>

      <section className="section">
        <div className="container grid-12">
          <div style={{ gridColumn: 'span 7' }}>
            <WorkshopAbout program={program} />
            <h3 style={{ marginTop: 40 }}>Schedule</h3>
            <Schedule cohort={cohort} />
            <p className="small" style={{ marginTop: 12 }}>
              All times in India Standard Time (IST). Starts {formatDate(cohort.startsAt, cohort.timezone)} at {formatTime(cohort.startsAt, cohort.timezone)}.
              {cohort.seatLimit ? ` Limited to ${cohort.seatLimit} participants.` : ''}
            </p>
          </div>

          <aside style={{ gridColumn: '9 / span 4' }}>
            <div className="sticky-aside">
              {open ? (
                <div className="form-card" id="register">
                  <h2 style={{ fontSize: '1.5rem' }}>Reserve your seat</h2>
                  <p className="small">{formatDate(cohort.startsAt, cohort.timezone)} · {formatTime(cohort.startsAt, cohort.timezone)} · Live on Zoom</p>
                  <WorkshopCheckoutForm
                    cohort={{
                      id: cohort.id,
                      title: cohort.title,
                      priceInr: cohort.priceInr,
                      compareAtPriceInr: cohort.compareAtPriceVerified ? cohort.compareAtPriceInr : null,
                      vipAddon: cohort.vipAddon,
                    }}
                  />
                </div>
              ) : (
                <div className="form-card" id="waitlist">
                  <span className="tag tag--muted">{state === 'sold_out' ? 'Sold out' : 'Registration closed'}</span>
                  <h2 style={{ fontSize: '1.5rem', marginTop: 14 }}>{state === 'sold_out' ? 'This date is full' : 'This workshop is no longer open'}</h2>
                  <p className="small">
                    Check the <Link href="/workshop">other upcoming dates</Link>, or join the waitlist and you’ll hear first when new dates open.
                  </p>
                  <WaitlistForm programId="workshop" buttonLabel="Notify Me" />
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      <WorkshopFrameworksAndFaq frameworks={frameworks} faqs={faqs} />

      <MobileStickyCta label={open ? `Reserve Your Seat · ${formatInr(cohort.priceInr)}` : 'See Upcoming Dates'} href={open ? '#register' : '/workshop'} />
    </>
  );
}
