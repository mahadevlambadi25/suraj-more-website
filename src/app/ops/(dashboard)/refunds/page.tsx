import Link from 'next/link';
import { listRefunds } from '@/lib/admin/queries';
import { hasRole } from '@/lib/auth/session';
import { requireAdmin } from '@/lib/auth/guards';
import { syncRefundAction } from '../../actions';
import { ActionForm } from '../../_components/ActionForm';
import { Badge, Card, EmptyState, Flash, fmtDate, money, PageHeader, type SP } from '../../_components/ui';

export default async function RefundsPage({ searchParams }: { searchParams: SP }) {
  const admin = await requireAdmin('VIEWER');
  const sp = await searchParams;
  const refunds = await listRefunds();
  const canAct = hasRole(admin, 'ADMIN');
  const refundedPaise = refunds.filter((r) => r.status === 'SUCCESS').reduce((s, r) => s + r.amountPaise, 0);
  const inProgress = refunds.filter((r) => r.status === 'PENDING' || r.status === 'ONHOLD').length;

  return (
    <>
      <PageHeader title="Refunds" description="Refunds are started from an order’s page and executed only through Cashfree’s server API. Each order can have at most one active refund." />
      <Flash msg={sp.msg} err={sp.err} />

      <div className="o-stats o-stats--fit">
        <div className="o-card o-stat"><span className="o-stat-label">Refunds</span><div className="o-stat-value">{refunds.length}</div></div>
        <div className="o-card o-stat"><span className="o-stat-label">In progress</span><div className="o-stat-value">{inProgress}</div><div className="o-stat-note">Pending or on hold</div></div>
        <div className="o-card o-stat"><span className="o-stat-label">Refunded</span><div className="o-stat-value">{money(refundedPaise)}</div><div className="o-stat-note">Completed refunds</div></div>
      </div>

      <Card flush>
        {refunds.length === 0 ? (
          <EmptyState icon="refunds" title="No refunds yet" action={<Link href="/ops/orders?status=paid" className="o-btn o-btn--secondary">View paid orders</Link>}>
            To refund a customer, open their paid order and use “Issue refund”.
          </EmptyState>
        ) : (
          <div className="o-table-wrap">
            <table className="o-table">
              <thead><tr><th>Refund</th><th>Order</th><th className="o-num">Amount</th><th>Status</th><th className="o-hide-sm">Requested by</th><th className="o-hide-sm">Completed</th><th /></tr></thead>
              <tbody>
                {refunds.map((r) => (
                  <tr key={r.id}>
                    <td className="o-mono">{r.refundNumber}<span className="o-cell-sub">{fmtDate(r.createdAt)}{r.providerRefundId ? ` · Cashfree ${r.providerRefundId}` : ''}</span></td>
                    <td><Link href={`/ops/orders/${r.order.id}`} className="o-row-link o-mono">{r.order.orderNumber}</Link><span className="o-cell-sub">{r.order.customerName}</span></td>
                    <td className="o-num o-strong">{money(r.amountPaise)}</td>
                    <td><Badge value={r.status} />{r.failureReason && <span className="o-cell-sub" style={{ color: 'var(--o-bad)' }}>{r.failureReason}</span>}</td>
                    <td className="o-hide-sm">{r.requestedBy?.name ?? 'Cashfree portal'}<span className="o-cell-sub">{r.reason}</span></td>
                    <td className="o-hide-sm o-nowrap">{fmtDate(r.processedAt)}</td>
                    <td>{canAct && (r.status === 'PENDING' || r.status === 'ONHOLD') && <div className="o-table-actions"><ActionForm action={syncRefundAction} fields={{ refundId: r.id }} returnTo="/ops/refunds" label="Sync status" pendingLabel="Syncing…" /></div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
