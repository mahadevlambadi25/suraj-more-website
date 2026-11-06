// Inline stroke icons (24px grid, 1.7 stroke) — no icon library needed.
import type { ReactNode } from 'react';

export type IconName =
  | 'overview' | 'leads' | 'workshops' | 'orders' | 'webhooks' | 'refunds' | 'mentorship' | 'settings'
  | 'search' | 'bell' | 'menu' | 'chevron-right' | 'chevron-left' | 'chevron-down' | 'logout' | 'external'
  | 'alert' | 'check' | 'info' | 'download' | 'plus' | 'refresh' | 'send' | 'x' | 'inbox' | 'user' | 'clock' | 'currency' | 'collapse';

const PATHS: Record<IconName, ReactNode> = {
  overview: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  leads: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 010 7M18.5 14.8c1.6.7 2.6 2.5 3 5.2" /></>,
  workshops: <><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /><path d="M7.5 14h3M7.5 17h6" /></>,
  orders: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
  webhooks: <><path d="M4 12h3l2-5 4 10 2-5h5" /></>,
  refunds: <><path d="M4 12a8 8 0 108-8 8.3 8.3 0 00-6 2.5" /><path d="M4 4v4h4" /><path d="M12 8v4l3 2" /></>,
  mentorship: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8.5 7V5.5A1.5 1.5 0 0110 4h4a1.5 1.5 0 011.5 1.5V7M3 12.5h18" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  bell: <><path d="M6 9a6 6 0 1112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" /><path d="M10 20a2 2 0 004 0" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  'chevron-right': <path d="M9 6l6 6-6 6" />,
  'chevron-left': <path d="M15 6l-6 6 6 6" />,
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  logout: <><path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" /><path d="M10 17l-5-5 5-5M5 12h11" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4" /></>,
  alert: <><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4M12 17.2v.3" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16.5 9.5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.8v.3" /></>,
  download: <><path d="M12 4v11M7 10l5 5 5-5" /><path d="M4 19h16" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: <><path d="M20 12a8 8 0 01-14 5.3M4 12a8 8 0 0114-5.3" /><path d="M18 3v4h-4M6 21v-4h4" /></>,
  send: <><path d="M21 3L10 14" /><path d="M21 3l-7 18-4-7-7-4z" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  inbox: <><path d="M3 13l2.5-8h13L21 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path d="M3 13h5l1.5 2.5h5L16 13h5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  currency: <><path d="M7 5h10M7 9.5h10M7 5c4.5 0 6.5 2 6.5 4.5S11.5 14 7 14l7.5 6" /></>,
  collapse: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /><path d="M15.5 10l-2 2 2 2" /></>,
};

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
