/** Skeleton shown while a dashboard page loads its data. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading">
      <div className="o-page-head">
        <div style={{ display: 'grid', gap: 10 }}>
          <div className="o-skel" style={{ width: 220, height: 26 }} />
          <div className="o-skel" style={{ width: 360, height: 14 }} />
        </div>
      </div>
      <div className="o-stats">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="o-card o-stat" style={{ display: 'grid', gap: 12 }}>
            <div className="o-skel" style={{ width: '60%', height: 12 }} />
            <div className="o-skel" style={{ width: '40%', height: 24 }} />
          </div>
        ))}
      </div>
      <div className="o-card">
        <div className="o-card-head">
          <div className="o-skel" style={{ width: 160, height: 16 }} />
        </div>
        <div className="o-card-body" style={{ display: 'grid', gap: 14 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="o-skel" style={{ height: 16, width: `${92 - i * 6}%` }} />
          ))}
        </div>
      </div>
      <span className="o-sr">Loading…</span>
    </div>
  );
}
