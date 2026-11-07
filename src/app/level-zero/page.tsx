import { ArrowRight } from '@/components/Icons';
import { MobileStickyCta } from '@/components/MobileStickyCta';
import { FinalCta, PageHero, SectionHead } from '@/components/Sections';
import { TrackedLink } from '@/components/TrackedLink';
import { getProgram } from '@/lib/cms';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Level Zero: Free Sales Course & Community | Suraj More',
  absoluteTitle: true,
  description: 'A free course and community on the foundations of a structured, high-trust sales conversation. Join free on Whop.',
  path: '/level-zero',
});

// Outbound clicks go through /go/level-zero so they are counted server-side before redirecting to Whop.
const JOIN = '/go/level-zero';

export default async function LevelZeroPage() {
  const program = await getProgram('level-zero');
  return (
    <>
      <PageHero eyebrow="Free · Hosted on Whop" title="Level Zero" lead={program.summary}>
        <div className="btn-row">
          <TrackedLink href={JOIN} className="btn btn--primary btn--lg" cta="level_zero_hero" event="outbound_click" placement="hero">
            Join for Free <ArrowRight />
          </TrackedLink>
        </div>
        <p className="hero-note">You’ll be taken to Whop to create your free account.</p>
      </PageHero>

      <section className="section">
        <div className="container split">
          <div>
            <SectionHead eyebrow="Level Zero" title="Inside Level Zero" />
            <ul className="check-list">
              {program.curriculum.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </div>
          <div className="card">
            <h3>Is it for you?</h3>
            <ul className="check-list">
              {program.audience.map((a) => <li key={a}>{a}</li>)}
            </ul>
            <p className="small" style={{ margin: 0 }}>
              <strong>Format:</strong> {program.format}. Level Zero is free; access is managed on Whop under Whop’s terms.
            </p>
          </div>
        </div>
      </section>

      <section className="section section--stone">
        <div className="container">
          <SectionHead title="How it works" />
          <div className="cards cards--3">
            {[
              ['Join on Whop', 'Create your free account. It takes about a minute.'],
              ['Work through the lessons', 'Short, practical lessons you can use on your next call.'],
              ['Ask questions in the community', 'Bring real situations and learn alongside others doing the same work.'],
            ].map(([t, b], i) => (
              <article key={t} className="card">
                <span className="icon-num">{i + 1}</span>
                <h3>{t}</h3>
                <p style={{ margin: 0 }}>{b}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <FinalCta title="Start free, today." href={JOIN} label="Join for Free" cta="level_zero_final" />
      <MobileStickyCta label="Join Level Zero for Free" href={JOIN} />
    </>
  );
}
