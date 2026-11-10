import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLead } from '@/lib/admin/queries';
import { hasRole } from '@/lib/auth/session';
import { requireAdmin } from '@/lib/auth/guards';
import { updateLeadStatusAction } from '../../../actions';
import { SubmitButton } from '../../../_components/controls';
import { Badge, BackLink, Card, EmptyState, Flash, fmtDate, KV, label, money, PageHeader, type SP } from '../../../_components/ui';

export default async function LeadDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const admin = await requireAdmin('VIEWER');
  const { id } = await params;
  const sp = await searchParams;
  const lead = await getLead(id);
  if (!lead) notFound();
  const here = `/ops/leads/${lead.id}`;
  const activityCount = lead.freeTrainingRegistrations.length + lead.orders.length + lead.applications.length + lead.waitlistEntries.length;

  return (
    <>
      <PageHeader title={lead.name} description={<>{lead.email} · first seen {fmtDate(lead.createdAt)}</>} actions={<BackLink href="/ops/leads">All leads</BackLink>} />
      <Flash msg={sp.msg} err={sp.err} />

      <div className="o-grid-main">
        <div className="o-stack">
          <Card title="Contact">
            <KV items={[['Name', lead.name], ['Email', <a key="e" href={`mailto:${lead.email}`}>{lead.email}</a>], ['Phone', lead.phone ?? '—'], ['First source', <span key="s" style={{ textTransform: 'capitalize' }}>{label(lead.source)}</span>], ['Status', <Badge key="b" value={lead.status} />]]} />
          </Card>

          <Card title="Activity" description={`${activityCount} record${activityCount === 1 ? '' : 's'}`} flush>
            {activityCount === 0 ? (
              <EmptyState title="No activity">This lead has no registrations, orders or applications.</EmptyState>
            ) : (
              <div className="o-table-wrap">
                <table className="o-table">
                  <thead><tr><th>Type</th><th>Details</th><th>Status</th><th className="o-hide-sm">Date</th></tr></thead>
                  <tbody>
                    {lead.orders.map((o) => (
                      <tr key={o.id}><td className="o-cell-title">Workshop order</td><td><Link href={`/ops/orders/${o.id}`} className="o-row-link o-mono">{o.orderNumber}</Link><span className="o-cell-sub">{o.cohort.title} · {money(o.amountPaise)}</span></td><td><Badge value={o.status} /></td><td className="o-hide-sm o-nowrap">{fmtDate(o.createdAt)}</td></tr>
                    ))}
                    {lead.applications.map((a) => (
                      <tr key={a.id}><td className="o-cell-title">Mentorship application</td><td><Link href={`/ops/applications/${a.id}`} className="o-row-link">View application</Link></td><td><Badge value={a.status} /></td><td className="o-hide-sm o-nowrap">{fmtDate(a.createdAt)}</td></tr>
                    ))}
                    {lead.freeTrainingRegistrations.map((r) => (
                      <tr key={r.id}><td className="o-cell-title">Free training</td><td style={{ textTransform: 'capitalize' }}>{label(r.audienceType)}{r.city ? `, ${r.city}` : ''}</td><td><Badge tone="info">registered</Badge></td><td className="o-hide-sm o-nowrap">{fmtDate(r.createdAt)}</td></tr>
                    ))}
                    {lead.waitlistEntries.map((w) => (
                      <tr key={w.id}><td className="o-cell-title">Waitlist</td><td style={{ textTransform: 'capitalize' }}>{label(w.programId)}</td><td><Badge tone={w.notifiedAt ? 'ok' : 'muted'}>{w.notifiedAt ? 'notified' : 'waiting'}</Badge></td><td className="o-hide-sm o-nowrap">{fmtDate(w.createdAt)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="o-stack">
          <Card title="Lead status" description="Track where this person is in your pipeline">
            {hasRole(admin, 'ADMIN') ? (
              <form action={updateLeadStatusAction} className="o-form">
                <input type="hidden" name="leadId" value={lead.id} />
                <input type="hidden" name="returnTo" value={here} />
                <div className="o-field">
                  <label htmlFor="status">Status</label>
                  <select id="status" className="o-select" name="status" defaultValue={lead.status}>
                    {['NEW', 'CONTACTED', 'QUALIFIED', 'CUSTOMER', 'UNSUBSCRIBED'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
                  </select>
                </div>
                <SubmitButton pendingLabel="Saving…">Update status</SubmitButton>
              </form>
            ) : (
              <p><Badge value={lead.status} /> <span className="o-muted o-small">Viewers cannot change status.</span></p>
            )}
          </Card>
          <Card title="First-touch attribution">
            <KV items={[['Source', lead.utmSource], ['Medium', lead.utmMedium], ['Campaign', lead.utmCampaign], ['Term', lead.utmTerm], ['Content', lead.utmContent], ['Referrer', lead.referrer], ['Landing page', lead.landingPage]]} />
          </Card>
        </div>
      </div>
    </>
  );
}
