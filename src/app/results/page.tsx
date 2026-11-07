import { MobileStickyCta } from '@/components/MobileStickyCta';
import { FinalCta, PageHero, ProofList, SectionHead } from '@/components/Sections';
import { getPublishedCaseStudies, getPublishedTestimonials } from '@/lib/cms';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Client Results | Suraj More',
  absoluteTitle: true,
  description: 'Client stories shared with permission, with a clear source for every result. No inflated claims.',
  path: '/results',
});

export default async function ResultsPage() {
  const [testimonials, caseStudies] = await Promise.all([getPublishedTestimonials(), getPublishedCaseStudies()]);
  return (
    <>
      <PageHero
        eyebrow="Results"
        title="Client stories, told honestly."
        lead="Every story here is shared with the client’s permission. We show where each number comes from, and whether it’s client-reported or independently verified."
      />
      <section className="section">
        <div className="container">
          <SectionHead eyebrow="Stories" title="Testimonials & case studies" />
          <ProofList testimonials={testimonials} caseStudies={caseStudies} />
        </div>
      </section>
      <section className="section section--stone">
        <div className="container container--narrow">
          <SectionHead eyebrow="Our standard" title="How we publish results" />
          <ul className="check-list">
            <li>Written permission from every client, with their real name and role</li>
            <li>The exact wording the client approved, with no edits for effect</li>
            <li>A baseline, a time period and a source for every number</li>
            <li>A clear label: client-reported or independently verified</li>
            <li>No guarantees: results depend on your offer, your market and your effort</li>
          </ul>
        </div>
      </section>
      <FinalCta title="Ready for a structured sales process?" href="/mentorship" label="Explore Mentorship" cta="results_final" />
      <MobileStickyCta label="Explore Mentorship" href="/mentorship" />
    </>
  );
}
