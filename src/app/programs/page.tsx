import { MobileStickyCta } from '@/components/MobileStickyCta';
import { FaqList, OfferLadder, PageHero, SectionHead } from '@/components/Sections';
import { TrackedLink } from '@/components/TrackedLink';
import { getActiveCohort, getFaqs, getPrograms } from '@/lib/cms';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Sales Coaching Programs | Suraj More',
  absoluteTitle: true,
  description: 'Compare Level Zero (free), the One Skill Workshop (live) and Premium Mentorship (application only), and find your next step.',
  path: '/programs',
});

// "Which one fits?" cards — approved copy document §3.
const FIT = [
  { who: 'A coach (health, fitness, mindset and more)', need: 'To lead high-trust sales calls while staying focused on coaching.', next: 'Free training, then the workshop.', href: '/free-training', label: 'Watch the Free Training' },
  { who: 'A consultant or agency owner', need: 'Your offer is strong; your sales process needs structure.', next: 'Premium Mentorship.', href: '/mentorship', label: 'Apply for Mentorship' },
  { who: 'A sales professional or closer', need: 'Sharper discovery, objection handling and closing.', next: 'Level Zero, then the workshop.', href: '/level-zero', label: 'Join Level Zero' },
  { who: 'Already following Suraj', need: 'To compare the programs.', next: 'See below.', href: '#ladder', label: 'Compare Programs' },
];

export default async function ProgramsPage() {
  const [programs, cohort, faqs] = await Promise.all([getPrograms(), getActiveCohort(), getFaqs()]);
  const innerCircle = programs.find((p) => p.id === 'inner-circle');

  return (
    <>
      <PageHero
        eyebrow="Programs"
        title="Choose the right next step."
        lead="Three clearly different ways to work with Suraj, from a free starting point to private, application-only mentorship."
      />

      <section className="section">
        <div className="container">
          <SectionHead title="Which one fits?" />
          <div className="cards">
            {FIT.map((f) => (
              <article key={f.who} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <h3>{f.who}</h3>
                <p>{f.need}</p>
                <p style={{ color: 'var(--text)', fontWeight: 500 }}>Best next step: {f.next}</p>
                <TrackedLink href={f.href} className="text-link" cta={`fit_${f.label}`} placement="programs_fit">
                  {f.label} →
                </TrackedLink>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--stone" id="ladder">
        <div className="container">
          <SectionHead eyebrow="The offer ladder" title="Choose a Program" />
          <OfferLadder programs={programs} cohort={cohort} />
          {innerCircle && (
            <p className="center small" style={{ marginTop: 32 }}>
              <span className="tag tag--muted">Coming soon</span>&nbsp; <strong>{innerCircle.title}</strong>: coming soon. Details will be shared once confirmed.
            </p>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container container--narrow">
          <SectionHead eyebrow="Questions" title="Before you choose" />
          <FaqList faqs={faqs.filter((f) => ['format', 'time', 'live-vs-recorded', 'pricing'].includes(f.topic))} />
        </div>
      </section>
      <MobileStickyCta label="Choose a Program" href="/programs#ladder" />
    </>
  );
}
