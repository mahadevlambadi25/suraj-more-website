import Link from 'next/link';
import { globalSearch } from '@/lib/admin/dashboard';
import { requireAdmin } from '@/lib/auth/guards';
import { Icon } from '../../_components/icons';
import { Badge, Card, EmptyState, fmtDate, label, money, PageHeader, type SP } from '../../_components/ui';

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin('VIEWER');
  const sp = await searchParams;
  const r = await globalSearch(sp.q ?? '');
  const total = r.leads.length + r.orders.length + r.applications.length;

  return (
    <>
      <PageHeader title="Search" description="Find leads, orders and mentorship applications by name, email, phone or order number." />
      <form method="get" role="search" className="o-card" style={{ padding: 16, display: 'flex', gap: 8, marginBottom: 20 }}>
        <label htmlFor="search-q" className="o-sr">Search</label>
        <input id="search-q" className="o-input" type="search" name="q" defaultValue={r.q} placeholder="e.g. priya@, smw_8KQ…, 98765" autoFocus />
        <button type="submit" className="o-btn o-btn--primary"><Icon name="search" size={16} /> Search</button>
      </form>

      {r.q.length < 2 ? (
        <Card><EmptyState icon="search" title="Start typing to search">Enter at least 2 characters.</EmptyState></Card>
      ) : total === 0 ? (
        <Card><EmptyState icon="search" title={`No results for “${r.q}”`}>Check the spelling, or search by email or order number.</EmptyState></Card>
      ) : (
        <div className="o-stack">
          {r.leads.length > 0 && (
            <Card title={`Leads (${r.leads.length})`} flush>
              <div className="o-table-wrap">
                <table className="o-table">
                  <thead><tr><th>Name</th><th className="o-hide-sm">Phone</th><th>Status</th><th className="o-hide-sm">Created</th></tr></thead>
                  <tbody>
                    {r.leads.map((l) => (
                      <tr key={l.id}><td><Link href={`/ops/leads/${l.id}`} className="o-row-link">{l.name}</Link><span className="o-cell-sub">{l.email}</span></td><td className="o-hide-sm">{l.phone ?? '—'}</td><td><Badge value={l.status} /></td><td className="o-hide-sm o-nowrap">{fmtDate(l.createdAt)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          {r.orders.length > 0 && (
            <Card title={`Orders (${r.orders.length})`} flush>
              <div className="o-table-wrap">
                <table className="o-table">
                  <thead><tr><th>Order</th><th>Customer</th><th className="o-num">Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {r.orders.map((o) => (
                      <tr key={o.id}><td><Link href={`/ops/orders/${o.id}`} className="o-row-link o-mono">{o.orderNumber}</Link><span className="o-cell-sub">{o.cohort.title}</span></td><td>{o.customerName}<span className="o-cell-sub">{o.customerEmail}</span></td><td className="o-num">{money(o.amountPaise)}</td><td><Badge value={o.status} /></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          {r.applications.length > 0 && (
            <Card title={`Mentorship applications (${r.applications.length})`} flush>
              <div className="o-table-wrap">
                <table className="o-table">
                  <thead><tr><th>Applicant</th><th>Status</th><th className="o-hide-sm">Received</th></tr></thead>
                  <tbody>
                    {r.applications.map((a) => (
                      <tr key={a.id}><td><Link href={`/ops/applications/${a.id}`} className="o-row-link">{a.name}</Link><span className="o-cell-sub">{a.email}</span></td><td><Badge value={a.status}>{a.status === 'NEW' ? label('awaiting decision') : undefined}</Badge></td><td className="o-hide-sm o-nowrap">{fmtDate(a.createdAt)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
