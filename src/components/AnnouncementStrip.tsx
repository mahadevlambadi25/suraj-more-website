'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TrackedLink } from './TrackedLink';

export type AnnouncedCohort = { title: string; href: string; startsAt: string; dateLabel: string; timeLabel: string; priceLabel: string };

/**
 * The next open workshop, rendered by the server on first load. Because the root layout is NOT re-rendered
 * on client-side navigation, the banner re-checks /api/workshops/next on every in-site navigation and when
 * the tab regains focus — so closing or unpublishing a workshop in /ops removes it from already-open tabs.
 * It also auto-expires the moment the workshop starts.
 */
export function AnnouncementStrip({ initial }: { initial: AnnouncedCohort | null }) {
  const pathname = usePathname();
  const [cohort, setCohort] = useState<AnnouncedCohort | null>(initial);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      fetch('/api/workshops/next', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((j: { cohort: AnnouncedCohort | null }) => {
          if (!cancelled) setCohort(j.cohort);
        })
        .catch(() => undefined); // network hiccup: keep what we have; the order API re-checks anyway
    refresh();
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pathname]);

  useEffect(() => {
    setExpired(false);
    if (!cohort) return;
    const ms = new Date(cohort.startsAt).getTime() - Date.now();
    if (ms <= 0) return setExpired(true);
    const t = setTimeout(() => setExpired(true), Math.min(ms, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [cohort]);

  if (!cohort || expired) return null;
  return (
    <div className="announce" role="region" aria-label="Upcoming workshop">
      <div className="container">
        <span className="dot" aria-hidden="true" />
        <span>
          <strong>{cohort.title}</strong> · Live on Zoom · {cohort.dateLabel}, {cohort.timeLabel} · {cohort.priceLabel}
        </span>
        <TrackedLink href={cohort.href} cta="announcement" placement="announcement_strip">
          Reserve your seat →
        </TrackedLink>
      </div>
    </div>
  );
}
