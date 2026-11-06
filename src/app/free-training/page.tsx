import { FreeTrainingForm } from '@/components/forms/FreeTrainingForm';
import { SectionHead } from '@/components/Sections';
import { getFrameworks, getSettings } from '@/lib/cms';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Free Training',
  description: 'Watch Suraj More’s free training on how to lead a high-trust, high-ticket sales conversation — without pressure.',
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
              The structure behind a sales conversation that ends in a clear decision — and the three frameworks Suraj teaches to coaches,
              consultants and agency owners.
            </p>
            <ul className="check-list" style={{ color: '#c4cbd5' }}>
              <li>Why qualified prospects say “I need to think about it” — and what to do instead</li>
              <li>How to diagnose before you prescribe, using the Doctor Frame</li>
              <li>The Intent → Certainty → Close flow you can use on your next call</li>
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
                <span className="tag">{f.tagline}</span>
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
