import { MobileStickyCta } from '@/components/MobileStickyCta';
import { FaqList, OfferLadder, PageHero, SectionHead } from '@/components/Sections';
import { TrackedLink } from '@/components/TrackedLink';
import { getActiveCohort, getFaqs, getPrograms } from '@/lib/cms';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Programs',
  description: 'Level Zero (free), The One Skill Workshop (live) and Premium Mentorship (application only). Find the right next step for you.',
  path: '/programs',
});

const FIT = [
  { who: 'Coaches (health, fitness, mindset and more)', need: 'You want to lead high-trust sales calls while staying focused on coaching.', next: 'Start with the free training or join the One Skill Workshop.', href: '/free-training', label: 'Watch the Free Training' },
  { who: 'Consultants and agency owners', need: 'Your offer is strong — your sales process needs structure.', next: 'Apply for Premium Mentorship.', href: '/mentorship', label: 'Apply for Mentorship' },
  { who: 'Sales professionals and closers', need: 'You want sharper discovery, objection handling and closing.', next: 'Join Level Zero, then the workshop.', href: '/level-zero', label: 'Join Level Zero' },
  { who: 'You already know Suraj', need: 'You want to see the programs and the proof.', next: 'Compare the programs below.', href: '#ladder', label: 'Compare programs' },
];

export default async function ProgramsPage() {
  const [programs, cohort, faqs] = await Promise.all([getPrograms(), getActiveCohort(), getFaqs()]);
  const innerCircle = programs.find((p) => p.id === 'inner-circle');

  return (
    <>
      <PageHero
        eyebrow="Programs"
        title="Choose the right next step."
        lead="Three clearly different ways to work with Suraj — from a free starting point to private, application-only mentorship."
      />

      <section className="section">
        <div className="container">
          <SectionHead eyebrow="Which one fits?" title="Find yourself below" />
          <div className="cards">
            {FIT.map((f) => (
              <article key={f.who} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <h3>{f.who}</h3>
                <p>{f.need}</p>
                <p style={{ color: 'var(--text)', fontWeight: 500 }}>{f.next}</p>
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
              <span className="tag tag--muted">Coming soon</span>&nbsp; <strong>{innerCircle.title}</strong> — {innerCircle.summary}
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
