import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="section">
      <div className="container status-card">
        <p className="eyebrow" style={{ justifyContent: 'center' }}>404</p>
        <h1 style={{ fontSize: '2.4rem' }}>This page doesn’t exist.</h1>
        <p>The link may be old, or the page may have moved. Here are the best places to go next:</p>
        <div className="btn-row" style={{ justifyContent: 'center' }}>
          <Link href="/" className="btn btn--primary">Go to the homepage</Link>
          <Link href="/programs" className="btn btn--secondary">Explore Programs</Link>
        </div>
      </div>
    </section>
  );
}
