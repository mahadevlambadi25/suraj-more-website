'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Icon } from '../_components/icons';

/** Error state for any dashboard page (e.g. database temporarily unreachable). */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="o-card" role="alert">
      <div className="o-empty">
        <span className="o-empty-icon" style={{ color: 'var(--o-bad)' }}>
          <Icon name="alert" size={20} />
        </span>
        <h3>This page could not be loaded</h3>
        <p>
          The data could not be fetched — often a temporary database or network issue. No changes were made.
          {error.digest && <> Reference: <code>{error.digest}</code></>}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button type="button" className="o-btn o-btn--primary" onClick={reset}>
            <Icon name="refresh" size={16} /> Try again
          </button>
          <Link href="/ops" className="o-btn o-btn--secondary">
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
