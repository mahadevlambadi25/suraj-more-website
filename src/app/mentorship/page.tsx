import { MentorshipForm } from '@/components/forms/MentorshipForm';
import { ArrowRight } from '@/components/Icons';
import { MobileStickyCta } from '@/components/MobileStickyCta';
import { FaqList, PageHero, ProofList, SectionHead } from '@/components/Sections';
import { TrackedLink } from '@/components/TrackedLink';
import { getFaqs, getProgram, getPublishedCaseStudies, getPublishedTestimonials } from '@/lib/cms';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Premium Mentorship',
  description: 'Application-only private mentorship for consultants, coaches and agency owners who need a structured, repeatable sales process around a proven offer.',
  path: '/mentorship',
});

export default async function MentorshipPage() {
  const [program, faqs, testimonials, caseStudies] = await Promise.all([getProgram('mentorship'), getFaqs(), getPublishedTestimonials(), getPublishedCaseStudies()]);

  return (
    <>
      <PageHero eyebrow="Application only · Private advisory" title="Premium Mentorship" lead={program.summary}>
        <TrackedLink href="#apply" className="btn btn--primary btn--lg" cta="mentorship_hero" placement="hero">
          Apply for Mentorship <ArrowRight />
        </TrackedLink>
      </PageHero>

      <section className="section">
        <div className="container split">
          <div>
            <SectionHead eyebrow="Who it’s for" title="Selective by design" />
            <ul className="check-list">
              {program.audience.map((a) => <li key={a}>{a}</li>)}
              <li>You already have demand — qualified people are getting on calls</li>
              <li>You’re willing to have your real calls reviewed and to practise</li>
            </ul>
            <h3 style={{ marginTop: 32 }}>Not a fit if</h3>
            <ul className="check-list">
              <li>You don’t yet have a validated offer</li>
              <li>You’re looking for guaranteed revenue or a shortcut</li>
            </ul>
          </div>
          <div className="card">
            <h3>What we work on together</h3>
            <ul className="check-list">
              {program.curriculum.map((c) => <li key={c}>{c}</li>)}
            </ul>
            <p className="small" style={{ margin: 0 }}>
              Duration, format and investment are shared after your application is reviewed — only if it looks like a genuine fit.
            </p>
          </div>
        </div>
      </section>

      <section className="section section--stone">
        <div className="container">
          <SectionHead eyebrow="The process" title="How applying works" />
          <div className="cards">
            {[
              ['Apply', 'Answer a few questions about your offer and where sales conversations break down. About 5 minutes.'],
              ['Review', 'Suraj’s team reviews every application personally within 2 business days.'],
              ['Conversation', 'If it looks like a fit, you get a private link to book a call at a time that suits your timezone.'],
              ['Decide', 'You get a clear recommendation — including if mentorship isn’t the right step yet.'],
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

      <section className="section" id="apply">
        <div className="container container--narrow">
          <SectionHead eyebrow="Apply" title="Apply for Mentorship" lead="Tell us about your business. There are no wrong answers — honesty helps us tell you whether this is the right fit." />
          <div className="form-card">
            <MentorshipForm />
          </div>
        </div>
      </section>

      <section className="section section--stone">
        <div className="container">
          <SectionHead eyebrow="Client stories" title="Results from mentorship" />
          <ProofList testimonials={testimonials} caseStudies={caseStudies} ctaHref="#apply" ctaLabel="Apply for Mentorship" />
        </div>
      </section>

      <section className="section">
        <div className="container container--narrow">
          <SectionHead eyebrow="Questions" title="Mentorship FAQ" />
          <FaqList faqs={faqs.filter((f) => ['audience', 'pricing', 'results'].includes(f.topic))} />
        </div>
      </section>
      <MobileStickyCta label="Apply for Mentorship" href="#apply" />
    </>
  );
}
