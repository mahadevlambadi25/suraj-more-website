'use client';

import { useEffect, useState } from 'react';

/** Counts down to the REAL cohort start time — never an evergreen timer (brief §7). */
export function Countdown({ to }: { to: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);

  if (now === null) return <div className="countdown" aria-hidden="true" style={{ minHeight: 52 }} />;
  const diff = Math.max(0, target - now);
  if (diff === 0) return null;
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);

  return (
    <div className="countdown" role="timer" aria-label={`Starts in ${d} days, ${h} hours and ${m} minutes`}>
      <div><strong>{d}</strong><span>Days</span></div>
      <div><strong>{h}</strong><span>Hours</span></div>
      <div><strong>{m}</strong><span>Min</span></div>
    </div>
  );
}
