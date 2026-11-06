// Presentational building blocks for the operations panel (server-safe; no client state).
import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatPaise } from '@/lib/money';
import { Icon, type IconName } from './icons';

export type SP = Promise<Record<string, string | undefined>>;

// ── Formatting ──
export const fmtDate = (d?: Date | string | null) =>
  d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
export const fmtDay = (d?: Date | string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const money = (paise?: number | null) => (paise == null ? '—' : formatPaise(paise));
export const label = (v: string) => v.replace(/_/g, ' ').toLowerCase();

export function timeAgo(d: Date | string) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  return days < 30 ? `${days} d ago` : fmtDay(d);
}

// ── Status badges (one mapping for the whole panel) ──
const TONE: Record<string, 'ok' | 'warn' | 'bad' | 'info' | 'muted'> = {
  PAID: 'ok', SUCCESS: 'ok', PROCESSED: 'ok', CONFIRMED: 'ok', ACCEPTED: 'ok', OPEN: 'ok', SENT: 'ok', CUSTOMER: 'ok', QUALIFIED: 'info',
  PENDING: 'warn', REFUND_PENDING: 'warn', RECEIVED: 'warn', NEW: 'info', ONHOLD: 'warn', CONTACTED: 'info', DRAFT: 'muted',
  NEEDS_REVIEW: 'bad', FAILED: 'bad', REJECTED: 'bad', NOT_CONFIGURED: 'bad', DROPPED: 'muted',
  REFUNDED: 'muted', CLOSED: 'muted', IGNORED: 'muted', CANCELLED: 'muted', UNSUBSCRIBED: 'muted', SKIPPED: 'muted',
};

export function Badge({ value, tone, children }: { value?: string; tone?: 'ok' | 'warn' | 'bad' | 'info' | 'muted'; children?: ReactNode }) {
  const t = tone ?? (value ? TONE[value] : undefined) ?? 'muted';
  return <span className={`o-badge o-badge--${t}`}>{children ?? (value ? label(value) : '')}</span>;
}

// ── Layout pieces ──
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="o-page-head">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="o-page-actions">{actions}</div>}
    </header>
  );
}

export function Card({ title, description, actions, children, flush, footer, className = '' }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; flush?: boolean; footer?: ReactNode; className?: string }) {
  return (
    <section className={`o-card ${flush ? 'o-card-flush' : ''} ${className}`}>
      {(title || actions) && (
        <div className="o-card-head">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {flush ? children : <div className="o-card-body">{children}</div>}
      {footer && <div className="o-card-foot">{footer}</div>}
    </section>
  );
}

export function StatCard({ label: l, value, note, icon, href }: { label: string; value: ReactNode; note?: ReactNode; icon: IconName; href: string }) {
  return (
    <Link href={href} className="o-card o-stat">
      <span className="o-stat-label"><Icon name={icon} size={16} /> {l}</span>
      <div className="o-stat-value">{value}</div>
      {note && <div className="o-stat-note">{note}</div>}
    </Link>
  );
}

export function EmptyState({ icon = 'inbox', title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="o-empty">
      <span className="o-empty-icon"><Icon name={icon} size={20} /></span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Alert({ tone, title, children }: { tone: 'ok' | 'bad' | 'warn' | 'info'; title?: string; children: ReactNode }) {
  const icon: IconName = tone === 'ok' ? 'check' : tone === 'info' ? 'info' : 'alert';
  return (
    <div className={`o-alert o-alert--${tone}`} role={tone === 'bad' ? 'alert' : 'status'}>
      <Icon name={icon} size={18} />
      <div>
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

/** Success / error feedback after a server action (?msg= / ?err=). */
export function Flash({ msg, err }: { msg?: string; err?: string }) {
  if (!msg && !err) return null;
  return <div className="o-flash">{err ? <Alert tone="bad" title="Action failed">{err}</Alert> : <Alert tone="ok">{msg}</Alert>}</div>;
}

export function Segments({ items, current, base, keep = {} }: { items: [string, string, number?][]; current?: string; base: string; keep?: Record<string, string | undefined> }) {
  const href = (v: string) => {
    const q = new URLSearchParams(Object.entries({ ...keep, status: v || undefined }).filter(([, x]) => x) as [string, string][]);
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  return (
    <nav className="o-segment" aria-label="Filter by status">
      {items.map(([v, l, count]) => (
        <Link key={v || 'all'} href={href(v)} aria-current={(current ?? '') === v ? 'page' : undefined}>
          {l}
          {count != null && <span className="o-seg-count">{count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function Pager({ page, pages, total, base, params, unit = 'results' }: { page: number; pages: number; total: number; base: string; params: Record<string, string | undefined>; unit?: string }) {
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries({ ...params, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `${base}?${q.toString()}`;
  };
  return (
    <nav className="o-pager" aria-label="Pagination">
      <span>
        {total} {unit}
        {pages > 1 && ` · page ${page} of ${pages}`}
      </span>
      {pages > 1 && (
        <span className="o-pager-links">
          {page > 1 ? <Link className="o-btn o-btn--secondary o-btn--sm" href={href(page - 1)}><Icon name="chevron-left" size={15} /> Previous</Link> : <span className="o-btn o-btn--secondary o-btn--sm" aria-disabled="true"><Icon name="chevron-left" size={15} /> Previous</span>}
          {page < pages ? <Link className="o-btn o-btn--secondary o-btn--sm" href={href(page + 1)}>Next <Icon name="chevron-right" size={15} /></Link> : <span className="o-btn o-btn--secondary o-btn--sm" aria-disabled="true">Next <Icon name="chevron-right" size={15} /></span>}
        </span>
      )}
    </nav>
  );
}

export function KV({ items, wide }: { items: [ReactNode, ReactNode][]; wide?: boolean }) {
  return (
    <dl className={`o-dl ${wide ? 'o-dl--wide' : ''}`}>
      {items.map(([k, v], i) => (
        <div key={i}>
          <dt>{k}</dt>
          <dd>{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="o-btn o-btn--secondary o-btn--sm">
      <Icon name="chevron-left" size={15} /> {children}
    </Link>
  );
}
