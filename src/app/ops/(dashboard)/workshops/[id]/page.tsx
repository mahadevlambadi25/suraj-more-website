import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCohortDetail } from '@/lib/admin/queries';
import { hasRole } from '@/lib/auth/session';
import { requireAdmin } from '@/lib/auth/guards';
import { isCohortPurchasable } from '@/lib/cohorts';
import { Alert, BackLink, Badge, Card, EmptyState, Flash, fmtDate, KV, money, PageHeader, type SP } from '../../../_components/ui';
import { CohortForm } from '../CohortForm';

export default async function CohortDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const admin = await requireAdmin('VIEWER');
  const { id } = await params;
  const sp = await searchParams;
  const detail = await getCohortDetail(id);
  if (!detail) notFound();
  const { cohort, waitlist } = detail;
  const confirmed = cohort.registrations.filter((r) => r.status === 'CONFIRMED');
  const bookable = isCohortPurchasable(cohort);
  const canEdit = hasRole(admin, 'ADMIN');

  return (
    <>
      <PageHeader title={cohort.title} description={<>Starts {fmtDate(cohort.startsAt)} IST · <span className="o-mono">{cohort.slug}</span></>} actions={<BackLink href="/ops/workshops">Workshops</BackLink>} />
      <Flash msg={sp.msg} err={sp.err} />
      {cohort.isSample && <div className="o-flash"><Alert tone="warn" title="Sample cohort">Hidden from the public website in production builds.</Alert></div>}
      {!cohort.zoomJoinUrl && <div className="o-flash"><Alert tone="warn" title="No Zoom link">Paid participants will not receive a join link until one is added below.</Alert></div>}

      <div className="o-stats o-stats--fit">
        <div className="o-card o-stat"><span className="o-stat-label">Status</span><div className="o-stat-value" style={{ fontSize: 18 }}><Badge value={cohort.status} /></div><div className="o-stat-note">Bookable now: {bookable ? 'yes' : 'no'}</div></div>
        <div className="o-card o-stat"><span className="o-stat-label">Confirmed seats</span><div className="o-stat-value">{confirmed.length}{cohort.seatLimit ? <span className="o-muted" style={{ fontSize: 16 }}> / {cohort.seatLimit}</span> : ''}</div></div>
        <div className="o-card o-stat"><span className="o-stat-label">Price</span><div className="o-stat-value">{money(cohort.pricePaise)}</div>{cohort.vipAddonActive && <div className="o-stat-note">+ {money(cohort.vipAddonPricePaise)} VIP add-on</div>}</div>
        <div className="o-card o-stat"><span className="o-stat-label">Waitlist</span><div className="o-stat-value">{waitlist.length}</div><div className="o-stat-note">Workshop waitlist</div></div>
      </div>

      <div className="o-stack">
        <Card title="Participants" description={`${cohort.registrations.length} registration${cohort.registrations.length === 1 ? '' : 's'}`} flush>
          {cohort.registrations.length === 0 ? (
            <EmptyState icon="leads" title="No participants yet">Registrations appear here once a payment is verified.</EmptyState>
          ) : (
            <div className="o-table-wrap">
              <table className="o-table">
                <thead><tr><th>Participant</th><th className="o-hide-sm">Phone</th><th>VIP</th><th>Order</th><th>Status</th><th className="o-hide-sm">Registered</th></tr></thead>
                <tbody>
                  {cohort.registrations.map((r) => (
                    <tr key={r.id}>
                      <td><span className="o-cell-title">{r.name}</span><span className="o-cell-sub">{r.email}</span></td>
                      <td className="o-hide-sm">{r.phone}</td>
                      <td>{r.vipAddon ? <Badge tone="info">VIP</Badge> : <span className="o-muted">—</span>}</td>
                      <td><Link href={`/ops/orders/${r.orderId}`} className="o-row-link o-mono">{r.order.orderNumber}</Link><span className="o-cell-sub">{money(r.order.amountPaise)}</span></td>
                      <td><Badge value={r.status} /></td>
                      <td className="o-hide-sm o-nowrap">{fmtDate(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="o-grid-main">
          <Card title="Cohort settings" description={canEdit ? 'Changes to price apply to new orders only.' : 'Read-only for your role.'}>
            <CohortForm cohort={cohort} readOnly={!canEdit} />
          </Card>
          <div className="o-stack">
            <Card title="Summary">
              <KV items={[['Starts', fmtDate(cohort.startsAt)], ['Ends', fmtDate(cohort.endsAt)], ['Timezone', cohort.timezone], ['Created', fmtDate(cohort.createdAt)], ['Last updated', fmtDate(cohort.updatedAt)]]} />
            </Card>
            <Card title="Workshop waitlist" description="People asking to hear about the next cohort" flush>
              {waitlist.length === 0 ? (
                <EmptyState title="Nobody on the waitlist" />
              ) : (
                <div className="o-table-wrap">
                  <table className="o-table">
                    <thead><tr><th>Name</th><th>Joined</th></tr></thead>
                    <tbody>
                      {waitlist.map((w) => (
                        <tr key={w.id}><td><Link href={`/ops/leads/${w.leadId}`} className="o-row-link">{w.name}</Link><span className="o-cell-sub">{w.email}</span></td><td className="o-nowrap">{fmtDate(w.createdAt)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
