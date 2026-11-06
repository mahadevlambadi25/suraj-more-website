import { MobileStickyCta } from '@/components/MobileStickyCta';
import { Portrait } from '@/components/Portrait';
import { FinalCta, JsonLd, PageHero, SectionHead } from '@/components/Sections';
import { getFrameworks, getSettings } from '@/lib/cms';
import { pageMeta, personSchema } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'About Suraj',
  description: 'Suraj More’s story, sales philosophy and approach to coaching coaches, consultants and agency owners on high-ticket sales conversations.',
  path: '/about',
});

const PRINCIPLES = [
  { title: 'Lead, don’t push', body: 'Pressure creates resistance. Structure creates confidence — for you and for the buyer.' },
  { title: 'Diagnose before you prescribe', body: 'The expert who asks better questions earns more trust than the one who pitches harder.' },
  { title: 'Honest fit over every sale', body: 'A clear “this isn’t for you” protects your reputation and your delivery.' },
  { title: 'Systems over talent', body: 'Closing shouldn’t depend on mood or luck. A repeatable process makes results predictable.' },
];

export default async function AboutPage() {
  const [settings, frameworks] = await Promise.all([getSettings(), getFrameworks()]);
  return (
    <>
      <JsonLd data={personSchema()} />
      <PageHero
        eyebrow="About"
        title={<>Sales conversations, done with integrity.</>}
        lead={`${settings.founderName} is a ${settings.founderTitle.toLowerCase()} who helps coaches, consultants and agency owners lead qualified sales conversations with structure — not pressure.`}
        aside={<Portrait portrait={settings.founder.portrait} name={settings.founderName} priority />}
      />

      <section className="section">
        <div className="container container--narrow prose">
          <h2>The story</h2>
          {settings.founder.shortBio.map((p) => <p key={p}>{p}</p>)}
          <p>
            Over time, the pattern became obvious: most good businesses don’t have an offer problem. They have a conversation problem. The
            prospect is qualified and interested — and the call still ends in “let me think about it.”
          </p>
          <p>
            That is why Suraj’s work focuses on the conversation itself: a structure you can run on every call, frameworks you can remember under
            pressure, and a follow-up process that keeps good opportunities from going quiet.
          </p>
          <blockquote>The goal is not to become pushy. It is to lead a better sales conversation.</blockquote>
        </div>
      </section>

      <section className="section section--stone">
        <div className="container">
          <SectionHead eyebrow="Philosophy" title="What Suraj believes about selling" />
          <div className="cards">
            {PRINCIPLES.map((p, i) => (
              <article key={p.title} className="card">
                <span className="icon-num">{String(i + 1).padStart(2, '0')}</span>
                <h3>{p.title}</h3>
                <p style={{ margin: 0 }}>{p.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHead eyebrow="The method" title="Frameworks you’ll learn" />
          <ul className="cards" style={{ listStyle: 'none', padding: 0 }}>
            {frameworks.map((f) => (
              <li key={f.id} className="card">
                <span className="tag">{f.tagline}</span>
                <h3 style={{ marginTop: 14 }}>{f.name}</h3>
                <p style={{ margin: 0 }}>{f.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <FinalCta title="Find the right place to start." href="/programs" label="Explore Programs" cta="about_final" />
      <MobileStickyCta label="Explore Programs" href="/programs" />
    </>
  );
}
