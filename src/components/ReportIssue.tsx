'use client';

import { useEffect } from 'react';

/** Sends one anonymous report (path only) to /api/monitor. Never blocks or breaks the page. */
export function reportIssue(type: 'client_error' | 'not_found', digest?: string) {
  try {
    void fetch('/api/monitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, path: window.location.pathname, referrer: document.referrer || undefined, digest }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* monitoring must never throw */
  }
}

/** Mounted on the 404 page so broken links show up in /ops (PRD §13.3 "monitor … 404s"). */
export function ReportNotFound() {
  useEffect(() => reportIssue('not_found'), []);
  return null;
}
