import { MobileStickyCta } from '@/components/MobileStickyCta';
import { FinalCta, PageHero, ProofList, SectionHead } from '@/components/Sections';
import { getPublishedCaseStudies, getPublishedTestimonials } from '@/lib/cms';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Results',
  description: 'Client testimonials and case studies — published only with permission, real attribution and a clear source for every outcome.',
  path: '/results',
});

export default async function ResultsPage() {
  const [testimonials, caseStudies] = await Promise.all([getPublishedTestimonials(), getPublishedCaseStudies()]);
  return (
    <>
      <PageHero
        eyebrow="Results"
        title="Client stories, told honestly."
        lead="Every story here is shared with the client’s permission. We show where each number comes from, and we label whether it is client-reported or independently verified."
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
            <li>The exact wording the client approved — no edits for effect</li>
            <li>Baseline, period and source for every number</li>
            <li>A clear label: client-reported or independently verified</li>
            <li>No guarantees. Results vary with offer, market and effort.</li>
          </ul>
        </div>
      </section>
      <FinalCta title="Ready for a structured sales process?" href="/mentorship" label="Explore Mentorship" cta="results_final" />
      <MobileStickyCta label="Explore Mentorship" href="/mentorship" />
    </>
  );
}
