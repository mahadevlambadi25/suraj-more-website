import { WaitlistForm } from '@/components/forms/WaitlistForm';
import { ArrowRight } from '@/components/Icons';
import { MobileStickyCta } from '@/components/MobileStickyCta';
import { JsonLd, PageHero, SectionHead } from '@/components/Sections';
import { TrackedLink } from '@/components/TrackedLink';
import { WorkshopAbout, WorkshopCard, WorkshopFrameworksAndFaq } from '@/components/Workshop';
import { getFaqs, getFrameworks, getProgram, getUpcomingCohorts } from '@/lib/cms';
import { formatInr } from '@/lib/format';
import { pageMeta, workshopSchemas } from '@/lib/seo';

// Shows live workshop availability: always rendered fresh, so a cohort closed in /ops disappears on the very
// next visit or in-site navigation (static pages would be reused from the browser's router cache for minutes).
export const dynamic = 'force-dynamic';

export const metadata = pageMeta({
  title: 'One Skill Workshop: Live Sales Training | Suraj More',
  absoluteTitle: true,
  description: 'A two-day live Zoom workshop on leading sales conversations with certainty instead of pressure. For coaches, consultants and closers.',
  path: '/workshop',
});

export default async function WorkshopPage() {
  // Every workshop published (OPEN) in /ops and not yet started — soonest first.
  const [cohorts, program, frameworks, faqs] = await Promise.all([getUpcomingCohorts(), getProgram('workshop'), getFrameworks(), getFaqs()]);
  const single = cohorts.length === 1 && !cohorts[0].soldOut ? cohorts[0] : null;
  const eyebrow = cohorts.length
    ? `Live on Zoom · ${cohorts.length} upcoming date${cohorts.length === 1 ? '' : 's'}`
    : 'Live workshop · Not currently open';

  return (
    <>
      {cohorts.length > 0 && <JsonLd data={cohorts.flatMap((c) => workshopSchemas(c, c.soldOut))} />}
      <PageHero eyebrow={eyebrow} title="The One Skill Workshop" lead={program.summary}>
        <div className="btn-row">
          {single ? (
            <TrackedLink href={`/workshop/${single.slug}#register`} className="btn btn--primary btn--lg" cta="workshop_hero" placement="hero">
              Reserve Your Seat · {formatInr(single.priceInr)} <ArrowRight />
            </TrackedLink>
          ) : cohorts.length ? (
            <TrackedLink href="#dates" className="btn btn--primary btn--lg" cta="workshop_hero_dates" placement="hero">
              See Upcoming Dates <ArrowRight />
            </TrackedLink>
          ) : (
            <TrackedLink href="#waitlist" className="btn btn--primary btn--lg" cta="workshop_waitlist_hero" placement="hero">
              Join the Waitlist <ArrowRight />
            </TrackedLink>
          )}
        </div>
      </PageHero>

      <section className="section section--stone" id="dates">
        {/* Older links pointed at /workshop#register — keep that anchor landing on the dates. */}
        <span id="register" aria-hidden="true" />
        <div className="container">
          {cohorts.length ? (
            <>
              <SectionHead
                eyebrow="Upcoming dates"
                title={cohorts.length === 1 ? 'Next live workshop' : 'Choose your date'}
                lead="Each date has its own schedule, price and registration. All sessions are live on Zoom, in India Standard Time."
              />
              <div className="workshop-list">
                {cohorts.map((c) => <WorkshopCard key={c.id} cohort={c} />)}
              </div>
            </>
          ) : (
            <div className="container--narrow" style={{ marginInline: 'auto' }}>
              <div className="form-card" id="waitlist">
                <span className="tag tag--muted">Not currently open</span>
                <h2 style={{ fontSize: '1.5rem', marginTop: 14 }}>Notify me about the next cohort</h2>
                <p className="small">Dates for the next live workshop haven’t been announced yet. Join the waitlist and you’ll hear first.</p>
                <WaitlistForm programId="workshop" buttonLabel="Notify Me" />
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container container--narrow">
          <WorkshopAbout program={program} />
        </div>
      </section>

      <WorkshopFrameworksAndFaq frameworks={frameworks} faqs={faqs} />

      <MobileStickyCta
        label={single ? `Reserve Your Seat · ${formatInr(single.priceInr)}` : cohorts.length ? 'See Upcoming Dates' : 'Join the Waitlist'}
        href={single ? `/workshop/${single.slug}#register` : cohorts.length ? '#dates' : '#waitlist'}
      />
    </>
  );
}
