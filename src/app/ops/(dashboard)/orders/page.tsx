import Link from 'next/link';
import { orderStatusCounts } from '@/lib/admin/dashboard';
import { listOrders, ORDER_FILTERS } from '@/lib/admin/queries';
import { requireAdmin } from '@/lib/auth/guards';
import { Badge, Card, EmptyState, fmtDate, money, PageHeader, Pager, Segments, type SP } from '../../_components/ui';

export default async function OrdersPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin('VIEWER');
  const sp = await searchParams;
  const status = sp.status && sp.status in ORDER_FILTERS ? sp.status : undefined;
  const q = sp.q?.trim() || undefined;
  const [{ rows, total, page, pages }, counts] = await Promise.all([listOrders({ status, q, page: Number(sp.page) || 1 }), orderStatusCounts()]);

  return (
    <>
      <PageHeader title="Orders & payments" description="Workshop orders and their Cashfree payments. Orders become paid only through a verified payment event — there is no manual “mark as paid”." />
      <Card flush>
        <div className="o-toolbar">
          <Segments
            base="/ops/orders"
            current={status}
            keep={{ q }}
            items={[
              ['', 'All', counts.all],
              ['paid', 'Paid', counts.paid],
              ['pending', 'Pending', counts.pending],
              ['failed', 'Failed', counts.failed],
              ['refunded', 'Refunded', counts.refunded],
              ['review', 'Needs review', counts.review],
              ['attention', 'Needs attention', counts.attention],
            ]}
          />
          <form method="get" className="o-toolbar-group" role="search" aria-label="Search orders" style={{ width: 'auto' }}>
            {status && <input type="hidden" name="status" value={status} />}
            <label className="o-sr" htmlFor="order-q">Search orders</label>
            <input id="order-q" className="o-input" type="search" name="q" placeholder="Order no., Cashfree id, name or email" defaultValue={q} />
            <button type="submit" className="o-btn o-btn--secondary o-btn--sm">Search</button>
          </form>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon="orders" title={q || status ? 'No orders match' : 'No orders yet'} action={q || status ? <Link href="/ops/orders" className="o-btn o-btn--secondary">Show all orders</Link> : undefined}>
            {q || status ? 'Try another status or search term.' : 'Orders appear as soon as someone starts a workshop checkout.'}
          </EmptyState>
        ) : (
          <div className="o-table-wrap">
            <table className="o-table">
              <thead>
                <tr><th>Order</th><th>Customer</th><th className="o-num">Amount</th><th>Status</th><th className="o-hide-sm">Provider</th><th className="o-hide-sm">Paid</th><th className="o-hide-sm">Cashfree reference</th><th className="o-num"><span className="o-sr">Actions</span></th></tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/ops/orders/${o.id}`} className="o-row-link o-mono">{o.orderNumber}</Link><span className="o-cell-sub">{fmtDate(o.createdAt)}</span></td>
                    <td><span className="o-cell-title">{o.customerName}</span><span className="o-cell-sub">{o.cohort.title}{o.vipAddon ? ' + VIP' : ''}</span></td>
                    <td className="o-num o-strong">{money(o.amountPaise)}</td>
                    <td><Badge value={o.status} /></td>
                    <td className="o-hide-sm"><span style={{ textTransform: 'capitalize' }}>{o.provider.toLowerCase()}</span><span className="o-cell-sub">{o.providerMode}</span></td>
                    <td className="o-hide-sm o-nowrap">{fmtDate(o.paidAt)}</td>
                    <td className="o-hide-sm o-mono">{o.providerOrderId ?? '—'}{o.payments[0] && <span className="o-cell-sub">pay {o.payments[0].providerPaymentId}</span>}</td>
                    <td className="o-num">
                      <Link href={`/ops/orders/${o.id}`} className="o-btn o-btn--secondary o-btn--sm o-view-btn" aria-label={`View order ${o.orderNumber}`}>
                        View <span aria-hidden="true">→</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pages={pages} total={total} unit={total === 1 ? 'order' : 'orders'} base="/ops/orders" params={{ status, q }} />
      </Card>
    </>
  );
}
