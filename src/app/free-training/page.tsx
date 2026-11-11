import { FreeTrainingForm } from '@/components/forms/FreeTrainingForm';
import { SectionHead } from '@/components/Sections';
import { getFrameworks, getSettings } from '@/lib/cms';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Free Sales Training | Suraj More',
  absoluteTitle: true,
  description: 'Watch the free training on leading high-trust sales calls, with the three frameworks Suraj uses. Instant access.',
  path: '/free-training',
});

export default async function FreeTrainingPage() {
  const [settings, frameworks] = await Promise.all([getSettings(), getFrameworks()]);
  return (
    <>
      <section className="page-hero page-hero--split">
        <div className="container">
          <div>
            <p className="eyebrow">Free training · Watch instantly</p>
            <h1>{settings.freeTraining.headline}</h1>
            <p className="lead">
              The structure behind a call that ends in a clear decision, plus the three frameworks Suraj teaches coaches, consultants and
              agency owners.
            </p>
            <p className="small" style={{ color: '#8e98a7', marginBottom: 8 }}>You’ll learn</p>
            <ul className="check-list" style={{ color: '#c4cbd5' }}>
              <li>Why qualified prospects say “I need to think about it,” and what to do instead</li>
              <li>How to diagnose before you prescribe, using the Doctor Frame</li>
              <li>The Intent → Certainty → Close flow for your next call</li>
            </ul>
          </div>
          <div className="form-card" id="access">
            <h2 style={{ fontSize: '1.4rem' }}>Get instant access</h2>
            <p className="small">Free. The training opens right after you submit.</p>
            <FreeTrainingForm />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHead eyebrow="What’s covered" title="The frameworks in the training" />
          <ul className="cards cards--3" style={{ listStyle: 'none', padding: 0 }}>
            {frameworks.map((f) => (
              <li key={f.id} className="card">
                <p className="tagline">{f.tagline}</p>
                <h3 style={{ marginTop: 14 }}>{f.name}</h3>
                <p style={{ margin: 0 }}>{f.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
