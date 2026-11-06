import { Countdown } from '@/components/Countdown';
import { WaitlistForm } from '@/components/forms/WaitlistForm';
import { WorkshopCheckoutForm } from '@/components/forms/WorkshopCheckoutForm';
import { ArrowRight } from '@/components/Icons';
import { MobileStickyCta } from '@/components/MobileStickyCta';
import { FaqList, FrameworkCard, JsonLd, PageHero, Schedule, SectionHead } from '@/components/Sections';
import { TrackedLink } from '@/components/TrackedLink';
import { getActiveCohort, getFaqs, getFrameworks, getProgram } from '@/lib/cms';
import { formatDate, formatInr, formatTime } from '@/lib/format';
import { pageMeta, workshopSchemas } from '@/lib/seo';

export const revalidate = 300;

export const metadata = pageMeta({
  title: 'The One Skill Workshop',
  description: 'A two-day live Zoom workshop on leading sales conversations with certainty instead of pressure. For coaches, consultants and sales professionals.',
  path: '/workshop',
});

export default async function WorkshopPage() {
  const [cohort, program, frameworks, faqs] = await Promise.all([getActiveCohort(), getProgram('workshop'), getFrameworks(), getFaqs()]);
  const workshopFrameworks = frameworks.filter((f) => f.relatedProgram === 'workshop');

  return (
    <>
      {cohort && <JsonLd data={workshopSchemas(cohort)} />}
      <PageHero
        eyebrow={cohort ? `Live on Zoom · ${formatDate(cohort.startsAt, cohort.timezone)}` : 'Live workshop · Not currently open'}
        title="The One Skill Workshop"
        lead={program.summary}
      >
        {cohort ? (
          <>
            <div className="btn-row" style={{ marginBottom: 28 }}>
              <TrackedLink href="#register" className="btn btn--primary btn--lg" cta="workshop_hero" placement="hero">
                Reserve Workshop Seat · {formatInr(cohort.priceInr)} <ArrowRight />
              </TrackedLink>
            </div>
            <p className="small" style={{ color: '#8e98a7', marginBottom: 10 }}>Starts in</p>
            <Countdown to={cohort.startsAt} />
          </>
        ) : (
          <TrackedLink href="#waitlist" className="btn btn--primary btn--lg" cta="workshop_waitlist_hero" placement="hero">
            Join the waitlist <ArrowRight />
          </TrackedLink>
        )}
      </PageHero>

      <section className="section">
        <div className="container grid-12">
          <div style={{ gridColumn: 'span 7' }}>
            <SectionHead eyebrow="What you’ll learn" title="One skill that moves the most conversations forward" />
            <ul className="check-list">
              {program.curriculum.map((c) => <li key={c}>{c}</li>)}
              <li>Language you can use on your very next sales call</li>
            </ul>
            <h3 style={{ marginTop: 40 }}>Who it’s for</h3>
            <ul className="check-list">
              {program.audience.map((a) => <li key={a}>{a}</li>)}
            </ul>
            <h3 style={{ marginTop: 40 }}>Who it’s not for</h3>
            <p>Anyone looking for manipulative scripts or a shortcut that promises guaranteed revenue. This is a skill, and it takes practice.</p>

            {cohort && (
              <>
                <h3 style={{ marginTop: 40 }}>Schedule</h3>
                <Schedule cohort={cohort} />
                <p className="small" style={{ marginTop: 12 }}>
                  All times in India Standard Time (IST). Starts {formatDate(cohort.startsAt, cohort.timezone)} at {formatTime(cohort.startsAt, cohort.timezone)}.
                  {cohort.seatLimit ? ` Limited to ${cohort.seatLimit} participants.` : ''}
                </p>
              </>
            )}
          </div>

          <aside style={{ gridColumn: '9 / span 4' }}>
            <div className="sticky-aside">
              {cohort ? (
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
                  <span className="tag tag--muted">Not currently open</span>
                  <h2 style={{ fontSize: '1.5rem', marginTop: 14 }}>Notify me about the next cohort</h2>
                  <p className="small">Dates for the next live workshop haven’t been announced yet. Join the waitlist and you’ll hear first.</p>
                  <WaitlistForm programId="workshop" />
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      <section className="section section--stone">
        <div className="container">
          <SectionHead eyebrow="Inside the workshop" title="The frameworks we’ll practise live" />
          <div className="frameworks">
            {workshopFrameworks.map((f) => <FrameworkCard key={f.id} f={f} />)}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container container--narrow">
          <SectionHead eyebrow="Questions" title="Workshop FAQ" />
          <FaqList faqs={faqs.filter((f) => f.topic !== 'pricing')} />
        </div>
      </section>

      <MobileStickyCta label={cohort ? `Reserve Workshop Seat · ${formatInr(cohort.priceInr)}` : 'Join the waitlist'} href={cohort ? '#register' : '#waitlist'} />
    </>
  );
}
