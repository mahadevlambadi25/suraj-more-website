import { ArrowRight } from '@/components/Icons';
import { MobileStickyCta } from '@/components/MobileStickyCta';
import { Portrait } from '@/components/Portrait';
import { FaqList, FinalCta, FrameworkCard, JsonLd, OfferLadder, ProofList, SectionHead } from '@/components/Sections';
import { TrackedLink } from '@/components/TrackedLink';
import {
  getUpcomingCohorts,
  getFaqs,
  getFrameworks,
  getPrograms,
  getPublishedCaseStudies,
  getPublishedTestimonials,
  getSettings,
  getTrustPoints,
} from '@/lib/cms';
import { pageMeta, personSchema } from '@/lib/seo';

// Shows live workshop availability: always rendered fresh, so a cohort closed in /ops disappears on the very
// next visit or in-site navigation (static pages would be reused from the browser's router cache for minutes).
export const dynamic = 'force-dynamic';

export const metadata = pageMeta({
  title: 'Suraj More | Premium Sales Coach & Sales System Builder',
  absoluteTitle: true,
  description:
    'High-ticket sales coaching for coaches, consultants and agency owners. Lead better sales conversations with a repeatable structure.',
  path: '/',
});

const PAINS = [
  {
    title: '“I need to think about it.”',
    body: 'The call felt great. They liked you and the offer. And they still didn’t decide.',
  },
  {
    title: 'Conversions that swing month to month',
    body: 'Some weeks you close, some weeks you don’t, and you can’t say exactly why.',
  },
  {
    title: 'Follow-ups that go quiet',
    body: 'Qualified people drift away because nothing clear was agreed before the call ended.',
  },
];

export default async function HomePage() {
  const [settings, cohorts, programs, frameworks, faqs, testimonials, caseStudies, trust] = await Promise.all([
    getSettings(),
    getUpcomingCohorts(),
    getPrograms(),
    getFrameworks(),
    getFaqs(),
    getPublishedTestimonials(),
    getPublishedCaseStudies(),
    getTrustPoints(),
  ]);

  return (
    <>
      <JsonLd data={personSchema(settings.socials)} />

      {/* 1. Announcement strip → rendered in layout (only when a live cohort is open) */}

      {/* 2. Hero */}
      <section className="hero" aria-labelledby="hero-title">
        <div className="container">
          <div>
            <p className="eyebrow">{settings.founderTitle} · For coaches, consultants &amp; agency owners</p>
            <h1 id="hero-title">
              Make every qualified sales conversation <em>count.</em>
            </h1>
            <p className="lead">
              Practical sales coaching that gives you a clear structure for every call, so good prospects stop slipping away at the moment
              that matters. No pressure tactics.
            </p>
            <div className="btn-row">
              <TrackedLink href="/free-training" className="btn btn--primary btn--lg" cta="hero_primary" placement="hero">
                Watch the Free Training <ArrowRight />
              </TrackedLink>
              <TrackedLink href="/programs" className="btn btn--secondary btn--lg" cta="hero_secondary" placement="hero">
                Explore Programs
              </TrackedLink>
            </div>
            <p className="hero-note">Free · Watch instantly · No card needed</p>
          </div>
          <Portrait portrait={settings.founder.portrait} name={settings.founderName} priority />
        </div>
      </section>

      {/* 3. Trust strip — only approved proof points; otherwise an audience strip (no invented claims) */}
      <div className="trust">
        <div className="container">
          {trust.length > 0 ? (
            <>
              <span className="label">Proof</span>
              {trust.map((t) => <span key={t} className="item">{t}</span>)}
            </>
          ) : (
            <>
              <span className="label">Built for</span>
              <span className="item">Coaches</span>
              <span className="item">Consultants</span>
              <span className="item">Agency owners</span>
              <span className="item">Sales professionals</span>
            </>
          )}
        </div>
      </div>

      {/* 4. Problem recognition */}
      <section className="section" aria-labelledby="pain-title">
        <div className="container">
          <SectionHead eyebrow="Sound familiar?" title={<span id="pain-title">Your offer is good. The conversation is where it leaks.</span>} />
          <div className="cards cards--3">
            {PAINS.map((p) => (
              <article key={p.title} className="card pain-card">
                <span className="quote-mark" aria-hidden="true">“</span>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Core philosophy */}
      <section className="section section--dark philosophy">
        <div className="container">
          <figure style={{ margin: 0 }}>
            <blockquote>
              The goal is not to become pushy. It is to lead a <span>better sales conversation.</span>
            </blockquote>
            <figcaption>{settings.founderName}</figcaption>
          </figure>
        </div>
      </section>

      {/* 6. Frameworks with diagrams */}
      <section className="section" aria-labelledby="fw-title">
        <div className="container">
          <SectionHead
            eyebrow="The method"
            title={<span id="fw-title">A structure you can run on every call</span>}
            lead="Three simple frameworks that move a conversation from intent, to certainty, to a clear decision."
          />
          <p className="flow" style={{ justifyContent: 'flex-start', marginBottom: 28 }} aria-label="Intent, then Certainty, then Close">
            <span>Intent</span><span className="arrow" aria-hidden="true">→</span>
            <span>Certainty</span><span className="arrow" aria-hidden="true">→</span>
            <span>Close</span>
          </p>
          <div className="frameworks">
            {frameworks.map((f) => <FrameworkCard key={f.id} f={f} />)}
          </div>
        </div>
      </section>

      {/* 7. How Suraj helps */}
      <section className="section section--stone" aria-labelledby="help-title">
        <div className="container">
          <SectionHead eyebrow="How Suraj helps" title={<span id="help-title">Learn the skill. Then build the system.</span>} />
          <div className="split">
            <div className="card">
              <span className="icon-num">01</span>
              <h3>What you learn</h3>
              <ul className="check-list">
                <li>How to open a call so both sides know what it’s for</li>
                <li>Discovery that surfaces the real cost of staying stuck</li>
                <li>Presenting only what solves their problem, not your whole offer</li>
                <li>Handling hesitation without pushing</li>
              </ul>
            </div>
            <div className="card">
              <span className="icon-num">02</span>
              <h3>What we implement together</h3>
              <ul className="check-list">
                <li>A call structure built around your offer and your buyers</li>
                <li>Reviews of your real sales calls, with specific feedback</li>
                <li>A follow-up process that keeps qualified leads warm</li>
                <li>Simple tracking that shows where deals are leaking</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Offer ladder */}
      <section className="section" aria-labelledby="ladder-title">
        <div className="container">
          <SectionHead
            eyebrow="Ways to work with Suraj"
            title={<span id="ladder-title">Start where you are</span>}
            lead="Begin free, go deeper in a live workshop, or apply for private mentorship."
          />
          <OfferLadder programs={programs} cohorts={cohorts} />
        </div>
      </section>

      {/* 9. Proof / stories */}
      <section className="section section--stone" aria-labelledby="proof-title">
        <div className="container">
          <SectionHead eyebrow="Client stories" title={<span id="proof-title">Client stories, told honestly</span>} />
          <ProofList testimonials={testimonials.slice(0, 3)} caseStudies={caseStudies.slice(0, 1)} ctaHref="/results" ctaLabel="See all results" />
        </div>
      </section>

      {/* 10. About Suraj */}
      <section className="section" aria-labelledby="about-title">
        <div className="container about-split">
          <Portrait portrait={settings.founder.portrait} name={settings.founderName} />
          <div>
            <p className="eyebrow">About Suraj</p>
            <h2 id="about-title">Founder-led. Built from real sales conversations.</h2>
            {settings.founder.shortBio.map((p) => <p key={p}>{p}</p>)}
            <TrackedLink href="/about" className="text-link" cta="home_about" placement="about">
              Read Suraj’s story →
            </TrackedLink>
          </div>
        </div>
      </section>

      {/* 11. FAQ */}
      <section className="section section--stone" aria-labelledby="faq-title">
        <div className="container container--narrow">
          <SectionHead eyebrow="Questions" title={<span id="faq-title">Frequently asked</span>} />
          <FaqList faqs={faqs} />
        </div>
      </section>

      {/* 12. Final CTA — one dominant action */}
      <FinalCta
        title="Start with the free training."
        lead="See the structure behind a high-trust sales conversation, and decide if this approach is right for you."
        href="/free-training"
        label="Watch the Free Training"
        cta="home_final"
      />

      {/* 13. Footer → layout */}
      <MobileStickyCta label="Watch the Free Training" href="/free-training" />
    </>
  );
}
