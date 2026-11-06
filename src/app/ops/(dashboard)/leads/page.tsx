import Link from 'next/link';
import { listLeads } from '@/lib/admin/queries';
import { hasRole } from '@/lib/auth/session';
import { requireAdmin } from '@/lib/auth/guards';
import { Icon } from '../../_components/icons';
import { Badge, Card, EmptyState, fmtDate, label, PageHeader, Pager, type SP } from '../../_components/ui';

const SOURCES = ['FREE_TRAINING', 'WORKSHOP', 'MENTORSHIP', 'WAITLIST', 'IMPORT'];
const STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CUSTOMER', 'UNSUBSCRIBED'];

export default async function LeadsPage({ searchParams }: { searchParams: SP }) {
  const admin = await requireAdmin('VIEWER');
  const sp = await searchParams;
  const filters = {
    q: sp.q?.trim() || undefined,
    source: SOURCES.includes(sp.source ?? '') ? sp.source : undefined,
    status: STATUSES.includes(sp.status ?? '') ? sp.status : undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
  };
  const { rows, total, page, pages } = await listLeads({ ...filters, page: Number(sp.page) || 1 });
  const filtered = Object.values(filters).some(Boolean);
  const exportQs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageHeader
        title="Leads"
        description="Everyone who signed up for the free training, joined a waitlist, bought a workshop or applied for mentorship."
        actions={hasRole(admin, 'ADMIN') ? <a href={`/ops/leads/export${exportQs ? `?${exportQs}` : ''}`} className="o-btn o-btn--secondary"><Icon name="download" size={16} /> Export CSV</a> : undefined}
      />
      <Card flush>
        <form method="get" className="o-toolbar" role="search" aria-label="Filter leads">
          <div className="o-toolbar-group">
            <label className="o-sr" htmlFor="lead-q">Search name or email</label>
            <input id="lead-q" className="o-input" type="search" name="q" placeholder="Search name or email" defaultValue={filters.q} />
            <label className="o-sr" htmlFor="lead-source">Source</label>
            <select id="lead-source" className="o-select" name="source" defaultValue={filters.source ?? ''}>
              <option value="">All sources</option>
              {SOURCES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </select>
            <label className="o-sr" htmlFor="lead-status">Status</label>
            <select id="lead-status" className="o-select" name="status" defaultValue={filters.status ?? ''}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </select>
            <label className="o-sr" htmlFor="lead-from">From date</label>
            <input id="lead-from" className="o-input" type="date" name="from" defaultValue={filters.from} title="From (IST)" />
            <label className="o-sr" htmlFor="lead-to">To date</label>
            <input id="lead-to" className="o-input" type="date" name="to" defaultValue={filters.to} title="To (IST)" />
          </div>
          <div className="o-toolbar-group" style={{ width: 'auto' }}>
            {filtered && <Link href="/ops/leads" className="o-btn o-btn--ghost o-btn--sm">Clear</Link>}
            <button type="submit" className="o-btn o-btn--primary o-btn--sm">Apply filters</button>
          </div>
        </form>

        {rows.length === 0 ? (
          <EmptyState icon="leads" title={filtered ? 'No leads match these filters' : 'No leads yet'} action={filtered ? <Link href="/ops/leads" className="o-btn o-btn--secondary">Clear filters</Link> : undefined}>
            {filtered ? 'Try a different search term or widen the date range.' : 'Leads appear here as soon as someone submits a form on the website.'}
          </EmptyState>
        ) : (
          <div className="o-table-wrap">
            <table className="o-table">
              <thead>
                <tr><th>Name</th><th className="o-hide-sm">Contact</th><th>Source</th><th>Status</th><th className="o-hide-sm">Campaign</th><th className="o-hide-sm">Created</th></tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td><Link href={`/ops/leads/${l.id}`} className="o-row-link">{l.name}</Link><span className="o-cell-sub o-show-sm">{l.email}</span></td>
                    <td className="o-hide-sm">{l.email}<span className="o-cell-sub">{l.phone ?? 'No phone'}</span></td>
                    <td style={{ textTransform: 'capitalize' }}>{label(l.source)}</td>
                    <td><Badge value={l.status} /></td>
                    <td className="o-hide-sm o-small">{[l.utmSource, l.utmMedium, l.utmCampaign].filter(Boolean).join(' / ') || <span className="o-muted">Direct</span>}</td>
                    <td className="o-hide-sm o-nowrap">{fmtDate(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pages={pages} total={total} unit={total === 1 ? 'lead' : 'leads'} base="/ops/leads" params={filters} />
      </Card>
    </>
  );
}
