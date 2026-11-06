import type { LegalDoc } from '@/lib/types';

export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <>
      <section className="page-hero">
        <div className="container container--narrow">
          <p className="eyebrow">Legal</p>
          <h1 style={{ maxWidth: 'none' }}>{doc.title}</h1>
          <p className="small" style={{ color: '#8e98a7' }}>
            Version {doc.version} · Effective {new Date(doc.effectiveDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </section>
      <section className="section">
        <div className="container container--narrow prose">
          {!doc.reviewed && (
            <div className="draft-banner" role="note">
              <strong>Draft pending legal review.</strong> This document will be finalised before launch.
            </div>
          )}
          {doc.sections.map((s) => (
            <section key={s.heading}>
              <h2>{s.heading}</h2>
              {s.body.map((p) => <p key={p}>{p}</p>)}
            </section>
          ))}
        </div>
      </section>
    </>
  );
}
