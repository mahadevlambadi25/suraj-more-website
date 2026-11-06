'use client';

import { useEffect, useState } from 'react';
import { TrackedLink } from './TrackedLink';

/**
 * Shown only when a live cohort is open (server decides). Also auto-expires in the browser
 * the moment the cohort starts, so a cached page never shows a stale offer.
 */
export function AnnouncementStrip({ startsAt, dateLabel, timeLabel, priceLabel }: { startsAt: string; dateLabel: string; timeLabel: string; priceLabel: string }) {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const ms = new Date(startsAt).getTime() - Date.now();
    if (ms <= 0) return setExpired(true);
    const t = setTimeout(() => setExpired(true), Math.min(ms, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [startsAt]);

  if (expired) return null;
  return (
    <div className="announce" role="region" aria-label="Upcoming workshop">
      <div className="container">
        <span className="dot" aria-hidden="true" />
        <span>
          <strong>The One Skill Workshop</strong> · Live on Zoom · {dateLabel}, {timeLabel} · {priceLabel}
        </span>
        <TrackedLink href="/workshop" cta="announcement" placement="announcement_strip">
          Reserve your seat →
        </TrackedLink>
      </div>
    </div>
  );
}
