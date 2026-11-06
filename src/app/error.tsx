'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Hook point for error monitoring (e.g. Sentry.captureException(error)).
    console.error(error);
  }, [error]);

  return (
    <section className="section">
      <div className="container status-card">
        <p className="eyebrow" style={{ justifyContent: 'center' }}>Something went wrong</p>
        <h1 style={{ fontSize: '2.2rem' }}>We hit an unexpected error.</h1>
        <p>Please try again. If it keeps happening, contact us and mention reference {error.digest ?? 'n/a'}.</p>
        <div className="btn-row" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn btn--primary" onClick={reset}>Try again</button>
          <Link href="/contact" className="btn btn--secondary">Contact support</Link>
        </div>
      </div>
    </section>
  );
}
