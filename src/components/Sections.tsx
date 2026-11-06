import type { ReactNode } from 'react';
import type { CaseStudy, Faq, Framework, Program, PublicCohort, Testimonial } from '@/lib/types';
import { formatDate, formatInr, formatTime } from '@/lib/format';
import { ArrowRight } from './Icons';
import { TrackedLink } from './TrackedLink';
import { VideoPlayer } from './VideoPlayer';

export function JsonLd({ data }: { data: object | object[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

export function PageHero({ eyebrow, title, lead, children, aside }: { eyebrow: string; title: ReactNode; lead?: ReactNode; children?: ReactNode; aside?: ReactNode }) {
  return (
    <section className={`page-hero ${aside ? 'page-hero--split' : ''}`}>
      <div className="container">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {lead && <p className="lead">{lead}</p>}
          {children}
        </div>
        {aside}
      </div>
    </section>
  );
}

export function SectionHead({ eyebrow, title, lead, center }: { eyebrow?: string; title: ReactNode; lead?: ReactNode; center?: boolean }) {
  return (
    <div className={`section-head ${center ? 'section-head--center' : ''}`}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      {lead && <p className="lead" style={center ? { margin: '0 auto' } : undefined}>{lead}</p>}
    </div>
  );
}

// ── Frameworks with step diagrams ──
export function FrameworkCard({ f }: { f: Framework }) {
  return (
    <article className="card framework" id={f.id}>
      <div>
        <span className="tag">{f.tagline}</span>
        <h3 style={{ fontSize: '1.6rem' }}>{f.name}</h3>
        <p style={{ margin: 0 }}>{f.description}</p>
      </div>
      <ol className="steps" aria-label={`${f.name} steps`}>
        {f.steps.map((s) => (
          <li key={s.title}>
            <strong>{s.title}</strong>
            <span>{s.body}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}

// ── Offer ladder (three distinct tiers — never an undifferentiated list) ──
export function OfferLadder({ programs, cohort }: { programs: Program[]; cohort: PublicCohort | null }) {
  const order: Program['id'][] = ['level-zero', 'workshop', 'mentorship'];
  const items = order.map((id) => programs.find((p) => p.id === id)!).filter(Boolean);
  return (
    <div className="ladder">
      {items.map((p, i) => {
        const premium = p.id === 'mentorship';
        return (
          <article key={p.id} className={`card offer ${premium ? 'offer--premium' : ''}`}>
            <div className="step-label">
              <span>Step {i + 1}</span>
              <span className={`tag ${premium ? 'tag--dark' : ''}`}>{p.tierLabel}</span>
            </div>
            <h3>{p.title}</h3>
            {p.id === 'workshop' ? (
              cohort ? (
                <>
                  <p className="price">
                    {formatInr(cohort.priceInr)} <small>· live on Zoom</small>
                  </p>
                  <p className="offer-status">Next cohort: {formatDate(cohort.startsAt, cohort.timezone)}</p>
                </>
              ) : (
                <>
                  <p className="price"><small>Not currently open</small></p>
                  <p className="offer-status">Join the waitlist to hear about the next cohort.</p>
                </>
              )
            ) : (
              <p className="price">{p.priceLabel ?? <small>By application</small>}</p>
            )}
            <p>{p.summary}</p>
            <ul className="check-list">
              {p.curriculum.slice(0, 3).map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <TrackedLink href={p.cta.href} className={`btn ${premium ? 'btn--primary' : 'btn--secondary'}`} cta={`ladder_${p.id}`} placement="offer_ladder">
              {p.cta.label} <ArrowRight />
            </TrackedLink>
          </article>
        );
      })}
    </div>
  );
}

// ── FAQ (native details/summary → keyboard accessible) ──
export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="faq">
      {faqs.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <div className="answer">
            <p style={{ margin: 0 }}>{f.a}</p>
          </div>
        </details>
      ))}
    </div>
  );
}

// ── Proof (approved items only, with verification labels) ──
const verificationLabel = (v: Testimonial['verification']) => (v === 'independently-verified' ? 'Independently verified' : 'Client-reported');

export function ProofList({ testimonials, caseStudies, ctaHref = '/mentorship', ctaLabel = 'Explore Mentorship' }: { testimonials: Testimonial[]; caseStudies: CaseStudy[]; ctaHref?: string; ctaLabel?: string }) {
  if (testimonials.length === 0 && caseStudies.length === 0) {
    return (
      <div className="empty-state">
        <h3>Client stories are being verified</h3>
        <p>
          We only publish stories with the client’s written permission, their real name and role, and outcomes we can show the source for. The first
          stories will appear here soon.
        </p>
        <TrackedLink href={ctaHref} className="btn btn--secondary" cta="proof_empty" placement="proof">
          {ctaLabel} <ArrowRight />
        </TrackedLink>
      </div>
    );
  }
  return (
    <div className="stack">
      {testimonials.length > 0 && (
        <div className="cards">
          {testimonials.map((t) => (
            <figure key={t.id} className="card testimonial" style={{ margin: 0 }}>
              {t.video && <div style={{ marginBottom: 18 }}><VideoPlayer video={t.video} /></div>}
              {t.quote && <blockquote>“{t.quote}”</blockquote>}
              <figcaption>
                <span className="who">{t.client}</span>
                <br />
                <span className="small">{t.role} · {t.niche}</span>
                <br />
                <span className={`tag ${t.verification === 'independently-verified' ? 'tag--success' : 'tag--muted'}`} style={{ marginTop: 10 }}>
                  {verificationLabel(t.verification)}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {caseStudies.map((c) => (
        <article key={c.id} className="card">
          <span className={`tag ${c.verification === 'independently-verified' ? 'tag--success' : 'tag--muted'}`}>{verificationLabel(c.verification)}</span>
          <h3 style={{ marginTop: 14 }}>{c.client} · {c.role}</h3>
          <p><strong>Starting point:</strong> {c.startingPoint}</p>
          <p><strong>What we did:</strong> {c.intervention}</p>
          <dl className="metric-row">
            <div><dt>{c.outcome.metric} — before</dt><dd>{c.outcome.baseline}</dd></div>
            <div><dt>After</dt><dd>{c.outcome.result}</dd></div>
            <div><dt>Period · source</dt><dd>{c.outcome.period} · {c.outcome.source}</dd></div>
          </dl>
          {c.video && <VideoPlayer video={c.video} />}
          <p className="disclaimer">{c.caveat}</p>
        </article>
      ))}
      <p className="disclaimer">Results vary. These are individual experiences, not typical or guaranteed outcomes.</p>
    </div>
  );
}

// ── Cohort schedule ──
export function Schedule({ cohort }: { cohort: Pick<PublicCohort, 'sessions' | 'timezone'> }) {
  return (
    <div className="schedule">
      {cohort.sessions.map((s) => (
        <div key={s.label} className="schedule-item">
          <div className="when">
            {s.label}
            <small>{formatDate(s.startsAt, cohort.timezone)}</small>
            <small>
              {formatTime(s.startsAt, cohort.timezone)} – {formatTime(s.endsAt, cohort.timezone)}
            </small>
          </div>
          <div>{s.topic}</div>
        </div>
      ))}
    </div>
  );
}

export function FinalCta({ title, lead, href, label, cta = 'final' }: { title: ReactNode; lead?: ReactNode; href: string; label: string; cta?: string }) {
  return (
    <section className="section section--dark final-cta">
      <div className="container">
        <h2>{title}</h2>
        {lead && <p className="lead">{lead}</p>}
        <TrackedLink href={href} className="btn btn--primary btn--lg" cta={cta} placement="final_cta">
          {label} <ArrowRight />
        </TrackedLink>
      </div>
    </section>
  );
}
