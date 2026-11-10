import Link from 'next/link';
import { leadStatusSummary, listRecentOrders, recentActivity, type ActivityKind } from '@/lib/admin/dashboard';
import { getOverviewStats, listNeedsAttention, recentIntegrationProblems } from '@/lib/admin/queries';
import { requireAdmin } from '@/lib/auth/guards';
import { Icon, type IconName } from '../_components/icons';
import { Alert, Badge, Card, EmptyState, fmtDate, label, money, PageHeader, StatCard, timeAgo, type SP } from '../_components/ui';

const ACTIVITY_ICON: Record<ActivityKind, IconName> = {
  lead: 'user',
  order_paid: 'currency',
  order_failed: 'alert',
  order_created: 'orders',
  application: 'mentorship',
  waitlist: 'clock',
  refund: 'refunds',
};

/** Site alerts (channel OPS_ALERT) carry their human-readable message in the payload. */
function alertMessage(e: { channel: string; payload: unknown }) {
  if (e.channel !== 'OPS_ALERT') return null;
  const m = (e.payload as { message?: unknown } | null)?.message;
  return typeof m === 'string' ? m.slice(0, 200) : null;
}

export default async function OverviewPage({ searchParams }: { searchParams: SP }) {
  const admin = await requireAdmin('VIEWER');
  const { denied } = await searchParams;
  const [s, orders, activity, leadSummary, attention, deliveryIssues] = await Promise.all([
    getOverviewStats(),
    listRecentOrders(6),
    recentActivity(8),
    leadStatusSummary(),
    listNeedsAttention(6),
    recentIntegrationProblems(6),
  ]);
  const hour = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHeader
        title={`${greeting}, ${admin.name.split(' ')[0]}`}
        description="A live view of leads, workshop sales and mentorship applications."
        actions={
          <>
            <Link href="/ops/leads" className="o-btn o-btn--secondary"><Icon name="leads" size={16} /> View leads</Link>
            <Link href="/ops/workshops" className="o-btn o-btn--primary"><Icon name="workshops" size={16} /> Manage workshops</Link>
          </>
        }
      />
      {denied && <div className="o-flash"><Alert tone="bad" title="Access restricted">Your role does not have access to that page.</Alert></div>}

      <div className="o-stats">
        <StatCard icon="leads" label="Total leads" value={s.leads} href="/ops/leads" note="All sources" />
        <StatCard icon="workshops" label="Workshop registrations" value={s.registrations} href="/ops/workshops" note="Confirmed seats" />
        <StatCard icon="orders" label="Total orders" value={s.orders} href="/ops/orders" note={`${s.paidOrders} paid · ${s.failed} not completed`} />
        <StatCard icon="currency" label="Revenue" value={money(s.revenuePaise)} href="/ops/orders?status=paid" note="Paid orders, net of refunds" />
        <StatCard icon="clock" label="Pending payments" value={s.pending} href="/ops/orders?status=pending" note="Awaiting confirmation" />
        <StatCard icon="mentorship" label="Mentorship applications" value={s.applications} href="/ops/applications" note={s.newApplications ? `${s.newApplications} awaiting decision` : 'None awaiting decision'} />
      </div>

      {s.failedWebhooks > 0 && (
        <div className="o-flash">
          <Alert tone="bad" title={`${s.failedWebhooks} payment webhook${s.failedWebhooks > 1 ? 's' : ''} failed`}>
            Cashfree will retry automatically. <Link href="/ops/webhooks?status=failed">Review webhooks</Link>
          </Alert>
        </div>
      )}

      <div className="o-grid-main">
        <div className="o-stack">
          <Card title="Recent orders" description="Latest workshop checkouts" flush actions={<Link href="/ops/orders" className="o-btn o-btn--ghost o-btn--sm">View all <Icon name="chevron-right" size={15} /></Link>}>
            {orders.length === 0 ? (
              <EmptyState icon="orders" title="No orders yet">Orders appear here as soon as someone starts a workshop checkout.</EmptyState>
            ) : (
              <div className="o-table-wrap">
                <table className="o-table">
                  <thead><tr><th>Order</th><th className="o-hide-sm">Customer</th><th className="o-num">Amount</th><th>Status</th><th className="o-hide-sm">Created</th></tr></thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td><Link href={`/ops/orders/${o.id}`} className="o-row-link o-mono">{o.orderNumber}</Link><span className="o-cell-sub">{o.cohort.title}</span></td>
                        <td className="o-hide-sm"><span className="o-cell-title">{o.customerName}</span><span className="o-cell-sub">{o.customerEmail}</span></td>
                        <td className="o-num o-strong">{money(o.amountPaise)}</td>
                        <td><Badge value={o.status} /></td>
                        <td className="o-hide-sm o-nowrap">{fmtDate(o.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Needs attention" description="Amount mismatches, late webhooks and undelivered confirmations" flush actions={attention.length > 0 ? <Link href="/ops/orders?status=attention" className="o-btn o-btn--ghost o-btn--sm">View all <Icon name="chevron-right" size={15} /></Link> : undefined}>
            {attention.length === 0 ? (
              <EmptyState icon="check" title="Nothing needs attention">Every paid order has been delivered and no payment is stuck.</EmptyState>
            ) : (
              <div className="o-table-wrap">
                <table className="o-table">
                  <thead><tr><th>Order</th><th>Status</th><th className="o-hide-sm">Issue</th></tr></thead>
                  <tbody>
                    {attention.map((o) => {
                      const issue = o.fulfilmentError ?? (o.status === 'PENDING' ? 'Payment confirmation not received yet' : o.status === 'NEEDS_REVIEW' ? 'Amount or currency mismatch' : 'Confirmation or Zoom link not delivered');
                      return (
                        <tr key={o.id}>
                          <td>
                            <Link href={`/ops/orders/${o.id}`} className="o-row-link o-mono">{o.orderNumber}</Link>
                            <span className="o-cell-sub">{o.customerName} · {money(o.amountPaise)}</span>
                            <span className="o-cell-sub o-show-sm o-clamp-2">{issue}</span>
                          </td>
                          <td><Badge value={o.status} /></td>
                          <td className="o-hide-sm o-small" style={{ minWidth: 260 }}>{issue}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="o-stack">
          <Card title="Recent activity" flush>
            {activity.length === 0 ? (
              <EmptyState icon="clock" title="No activity yet">New leads, payments and applications will show up here.</EmptyState>
            ) : (
              <ul className="o-activity">
                {activity.map((a, i) => (
                  <li key={i}>
                    <span className="o-activity-icon"><Icon name={ACTIVITY_ICON[a.kind]} size={16} /></span>
                    <div className="o-activity-body">
                      <Link href={a.href} className="o-activity-text o-row-link">{a.title}</Link>
                      <div className="o-activity-time">{timeAgo(a.at)}{a.detail ? ` · ${a.detail}` : ''}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Lead status" description={`${leadSummary.total} lead${leadSummary.total === 1 ? '' : 's'} in total`}>
            {leadSummary.total === 0 ? (
              <p className="o-muted">No leads yet.</p>
            ) : (
              <div className="o-bars">
                {leadSummary.rows.map((r) => (
                  <Link key={r.status} href={`/ops/leads?status=${r.status}`} className="o-bar-row" style={{ textDecoration: 'none' }}>
                    <span className="o-bar-top"><span style={{ textTransform: 'capitalize' }}>{label(r.status)}</span><span>{r.count}</span></span>
                    <span className="o-bar"><span style={{ width: `${leadSummary.total ? (r.count / leadSummary.total) * 100 : 0}%` }} /></span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <div id="delivery" style={{ marginTop: 20 }}>
        <Card title="Message delivery & site alerts" description="Emails, WhatsApp messages and CRM syncs that were not delivered (provider not configured yet, or it returned an error), plus site alerts such as page errors, 404s and broken external links." flush>
          {deliveryIssues.length === 0 ? (
            <EmptyState icon="send" title="No delivery problems">All recorded messages were accepted by their provider.</EmptyState>
          ) : (
            <div className="o-table-wrap">
              <table className="o-table">
                <thead><tr><th>When</th><th>Channel</th><th className="o-hide-sm">Message</th><th className="o-hide-sm">Recipient</th><th>Status</th></tr></thead>
                <tbody>
                  {deliveryIssues.map((e) => (
                    <tr key={e.id}>
                      <td className="o-nowrap">{fmtDate(e.createdAt)}</td>
                      <td>{label(e.channel)}</td>
                      <td className="o-hide-sm">
                        {label(e.template)}
                        {alertMessage(e) && <span className="o-cell-sub o-break">{alertMessage(e)}</span>}
                        {e.error && <span className="o-cell-sub">{e.error}</span>}
                      </td>
                      <td className="o-hide-sm o-small">{e.recipient ?? '—'}</td>
                      <td><Badge value={e.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
