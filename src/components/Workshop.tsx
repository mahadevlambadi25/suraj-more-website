// Shared building blocks for the workshop overview (/workshop) and each workshop's own page (/workshop/[slug]).
import { formatInr, formatTime } from '@/lib/format';
import type { Faq, Framework, ListedCohort, Program } from '@/lib/types';
import { ArrowRight } from './Icons';
import { FaqList, FrameworkCard, SectionHead } from './Sections';
import { TrackedLink } from './TrackedLink';

/** "Sat, 19 Dec" (+ " 2026" when withYear), in the cohort's timezone. */
function dayLabel(iso: string, timeZone: string, withYear: boolean) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return `${p.weekday}, ${p.day} ${p.month}${withYear ? ` ${p.year}` : ''}`;
}

/** "Sat, 19 Dec 2026" for one day, or "Sat, 19 Dec – Sun, 20 Dec 2026" for a multi-day workshop. */
export function cohortDateRange(c: Pick<ListedCohort, 'startsAt' | 'endsAt' | 'timezone'>) {
  const end = dayLabel(c.endsAt, c.timezone, true);
  const startFull = dayLabel(c.startsAt, c.timezone, true);
  if (startFull === end) return end;
  const sameYear = startFull.slice(-4) === end.slice(-4);
  return `${dayLabel(c.startsAt, c.timezone, !sameYear)} – ${end}`;
}

export function seatsLabel(c: Pick<ListedCohort, 'seatsLeft' | 'soldOut'>) {
  if (c.soldOut) return 'Sold out';
  if (c.seatsLeft == null) return null;
  return `${c.seatsLeft} seat${c.seatsLeft === 1 ? '' : 's'} left`;
}

/** One card per upcoming workshop on /workshop. */
export function WorkshopCard({ cohort }: { cohort: ListedCohort }) {
  const seats = seatsLabel(cohort);
  const sessions = cohort.sessions.length;
  return (
    <article className="card workshop-card">
      <div className="workshop-card-top">
        <span className={`tag ${cohort.soldOut ? 'tag--muted' : 'tag--success'}`}>{cohort.soldOut ? 'Sold out' : 'Open for registration'}</span>
        {seats && !cohort.soldOut && <span className="workshop-card-seats">{seats}</span>}
      </div>
      <h3>{cohort.title}</h3>
      <dl className="workshop-card-facts">
        <div><dt>Dates</dt><dd>{cohortDateRange(cohort)}</dd></div>
        <div><dt>Time</dt><dd>{formatTime(cohort.startsAt, cohort.timezone)}{sessions > 1 ? ` · ${sessions} live sessions` : ''}</dd></div>
        <div><dt>Where</dt><dd>Live on Zoom</dd></div>
      </dl>
      <div className="workshop-card-price">
        <span className="price">{formatInr(cohort.priceInr)}</span>
        {cohort.vipAddon.active && <span className="workshop-card-addon">+ {formatInr(cohort.vipAddon.priceInr)} optional {cohort.vipAddon.title}</span>}
      </div>
      <TrackedLink href={`/workshop/${cohort.slug}`} className={`btn ${cohort.soldOut ? 'btn--secondary' : 'btn--primary'} btn--block`} cta="workshop_card" placement="workshop_list">
        {cohort.soldOut ? 'View Details' : 'View Details & Register'} <ArrowRight />
      </TrackedLink>
    </article>
  );
}

/** Curriculum + audience — identical on the overview and on every workshop page. */
export function WorkshopAbout({ program }: { program: Program }) {
  return (
    <>
      <SectionHead eyebrow="The One Skill Workshop" title="What you’ll learn" />
      <ul className="check-list">
        {program.curriculum.map((c) => <li key={c}>{c}</li>)}
        <li>Language you can use on your very next sales call</li>
      </ul>
      {program.included && program.included.length > 0 && (
        <>
          <h3 style={{ marginTop: 40 }}>What’s included</h3>
          <ul className="check-list">
            {program.included.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </>
      )}
      <h3 style={{ marginTop: 40 }}>Who it’s for</h3>
      <p>{program.audience.join(' · ')} who already have conversations but convert them inconsistently.</p>
      <h3 style={{ marginTop: 40 }}>Who it’s not for</h3>
      <p>Anyone looking for manipulative scripts or guaranteed revenue. This is a skill, and it takes practice.</p>
    </>
  );
}

export function WorkshopFrameworksAndFaq({ frameworks, faqs }: { frameworks: Framework[]; faqs: Faq[] }) {
  return (
    <>
      <section className="section section--stone">
        <div className="container">
          <SectionHead eyebrow="Inside the workshop" title="The frameworks we’ll practise live" />
          <div className="frameworks">
            {frameworks.filter((f) => f.relatedProgram === 'workshop').map((f) => <FrameworkCard key={f.id} f={f} />)}
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container container--narrow">
          <SectionHead eyebrow="Questions" title="Workshop FAQ" />
          <FaqList faqs={faqs.filter((f) => f.topic !== 'pricing')} />
        </div>
      </section>
    </>
  );
}
