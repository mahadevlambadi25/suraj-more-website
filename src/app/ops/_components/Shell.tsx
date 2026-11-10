'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';

export interface ShellAdmin {
  name: string;
  email: string;
  role: string;
}
export interface Notice {
  label: string;
  detail: string;
  count: number;
  href: string;
  icon: IconName;
}

const NAV: { group: string; items: { href: string; label: string; icon: IconName; countKey?: 'applications' | 'attention' }[] }[] = [
  { group: 'Overview', items: [{ href: '/ops', label: 'Dashboard', icon: 'overview' }] },
  {
    group: 'Business',
    items: [
      { href: '/ops/leads', label: 'Leads', icon: 'leads' },
      { href: '/ops/workshops', label: 'Workshops', icon: 'workshops' },
      { href: '/ops/orders', label: 'Orders & payments', icon: 'orders', countKey: 'attention' },
      { href: '/ops/applications', label: 'Mentorship', icon: 'mentorship', countKey: 'applications' },
      { href: '/ops/proof', label: 'Proof', icon: 'check' },
    ],
  },
  {
    group: 'Operations',
    items: [
      { href: '/ops/webhooks', label: 'Webhooks', icon: 'webhooks' },
      { href: '/ops/refunds', label: 'Refunds', icon: 'refunds' },
      { href: '/ops/settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

const CRUMB: Record<string, string> = {
  leads: 'Leads',
  workshops: 'Workshops',
  new: 'New cohort',
  orders: 'Orders & payments',
  webhooks: 'Webhooks',
  refunds: 'Refunds',
  applications: 'Mentorship',
  proof: 'Proof',
  testimonials: 'Testimonials',
  'case-studies': 'Case studies',
  settings: 'Settings',
  search: 'Search',
};

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onOutside();
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', k);
    };
  }, [ref, onOutside]);
}

function Menu({ button, label, children }: { button: (open: boolean) => ReactNode; label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  return (
    <div className="o-menu-wrap" ref={ref}>
      <span onClick={() => setOpen((o) => !o)} aria-label={label}>
        {button(open)}
      </span>
      {open && (
        <div className="o-menu" role="menu" aria-label={label}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function Shell({
  admin,
  paymentMode,
  notices,
  counts,
  logoutAction,
  children,
}: {
  admin: ShellAdmin;
  paymentMode: string;
  notices: Notice[];
  counts: { applications: number; attention: number };
  logoutAction: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('sm_ops_sidebar') === 'collapsed');
    } catch {
      /* storage unavailable */
    }
  }, []);
  useEffect(() => setMobileOpen(false), [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('sm_ops_sidebar', c ? 'expanded' : 'collapsed');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const isActive = (href: string) => (href === '/ops' ? pathname === '/ops' : pathname === href || pathname.startsWith(`${href}/`));
  const segments = pathname.split('/').filter(Boolean).slice(1); // drop "ops"
  const crumbs = segments.map((seg, i) => ({ label: CRUMB[seg] ?? 'Details', href: `/ops/${segments.slice(0, i + 1).join('/')}` }));
  const totalNotices = notices.reduce((s, n) => s + n.count, 0);
  const initials = admin.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || 'A';

  return (
    <div className="o-shell" data-collapsed={collapsed} data-mobile-open={mobileOpen}>
      <aside className="o-sidebar" aria-label="Operations navigation">
        <div className="o-brand">
          <span className="o-brand-mark" aria-hidden="true">SM</span>
          <span className="o-brand-text">
            <strong>Suraj More</strong>
            <span>Operations</span>
          </span>
        </div>
        <nav className="o-nav">
          {NAV.map((g) => (
            <div className="o-nav-group" key={g.group}>
              <div className="o-nav-label">{g.group}</div>
              <ul>
                {g.items.map((item) => {
                  const count = item.countKey ? counts[item.countKey] : 0;
                  return (
                    <li key={item.href}>
                      <Link href={item.href} className="o-nav-link" aria-current={isActive(item.href) ? 'page' : undefined} title={collapsed ? item.label : undefined}>
                        <Icon name={item.icon} />
                        <span className="o-nav-text">{item.label}</span>
                        {count > 0 && <span className="o-nav-count" aria-label={`${count} need attention`}>{count > 99 ? '99+' : count}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="o-side-foot">
          <div className="o-mode" data-mode={paymentMode} title={`Payments: ${paymentMode}`}>
            <span className="o-mode-dot" aria-hidden="true" />
            <span className="o-mode-text">
              Payments: <strong>{paymentMode}</strong>
            </span>
          </div>
          <button type="button" className="o-btn o-btn--ghost o-btn--sm o-collapse-btn" onClick={toggleCollapsed} aria-pressed={collapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <Icon name="collapse" size={16} />
            <span className="o-collapse-text">Collapse</span>
          </button>
        </div>
      </aside>
      <div className="o-overlay" onClick={() => setMobileOpen(false)} aria-hidden="true" />

      <div className="o-main">
        <header className="o-topbar">
          <div className="o-topbar-left">
            <button type="button" className="o-icon-btn o-menu-toggle" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Icon name="menu" />
            </button>
            <ol className="o-crumbs" aria-label="Breadcrumb">
              <li>{segments.length ? <Link href="/ops">Dashboard</Link> : 'Dashboard'}</li>
              {crumbs.map((c, i) => (
                <li key={c.href}>
                  <Icon name="chevron-right" size={14} />
                  {i === crumbs.length - 1 ? <span aria-current="page">{c.label}</span> : <Link href={c.href}>{c.label}</Link>}
                </li>
              ))}
            </ol>
          </div>
          <div className="o-topbar-right">
            <form action="/ops/search" method="get" role="search" className="o-search">
              <Icon name="search" size={16} />
              <label htmlFor="o-global-search" className="o-sr">Search leads, orders and applications</label>
              <input id="o-global-search" name="q" type="search" placeholder="Search leads, orders, applications…" defaultValue={pathname === '/ops/search' ? searchParams.get('q') ?? '' : ''} />
            </form>
            <Link href="/ops/search" className="o-icon-btn o-search-mobile" aria-label="Search">
              <Icon name="search" />
            </Link>

            <Menu
              label="Notifications"
              button={(open) => (
                <button type="button" className="o-icon-btn" aria-expanded={open} aria-label={`Notifications${totalNotices ? `, ${totalNotices} items need attention` : ''}`}>
                  <Icon name="bell" />
                  {totalNotices > 0 && <span className="o-dot">{totalNotices > 99 ? '99+' : totalNotices}</span>}
                </button>
              )}
            >
              {(close) => (
                <>
                  <div className="o-menu-head">
                    <strong>Needs attention</strong>
                  </div>
                  {notices.filter((n) => n.count > 0).length === 0 ? (
                    <div className="o-menu-empty">You’re all caught up.</div>
                  ) : (
                    notices
                      .filter((n) => n.count > 0)
                      .map((n) => (
                        <Link key={n.href + n.label} href={n.href} className="o-menu-item" role="menuitem" onClick={close}>
                          <Icon name={n.icon} size={16} />
                          <span>
                            <span className="o-strong">{n.label}</span>
                            <span className="o-cell-sub">{n.detail}</span>
                          </span>
                          <span className="o-menu-meta o-badge o-badge--bad">{n.count}</span>
                        </Link>
                      ))
                  )}
                </>
              )}
            </Menu>

            <Menu
              label="Account"
              button={(open) => (
                <button type="button" className="o-profile-btn" aria-expanded={open} aria-label="Account menu">
                  <span className="o-avatar">{initials}</span>
                  <span className="o-profile-name">
                    <strong>{admin.name}</strong>
                    <span>{admin.role.toLowerCase()}</span>
                  </span>
                  <Icon name="chevron-down" size={15} />
                </button>
              )}
            >
              {(close) => (
                <>
                  <div className="o-menu-head">
                    <strong>{admin.name}</strong>
                    <span className="o-cell-sub">{admin.email}</span>
                  </div>
                  <Link href="/ops/settings" className="o-menu-item" role="menuitem" onClick={close}>
                    <Icon name="settings" size={16} /> Settings
                  </Link>
                  <a href="/" className="o-menu-item" role="menuitem" target="_blank" rel="noopener noreferrer">
                    <Icon name="external" size={16} /> View website
                  </a>
                  <form action={logoutAction}>
                    <button type="submit" className="o-menu-item" role="menuitem">
                      <Icon name="logout" size={16} /> Sign out
                    </button>
                  </form>
                </>
              )}
            </Menu>
          </div>
        </header>
        <div className="o-content" id="ops-main">
          {children}
        </div>
      </div>
    </div>
  );
}
