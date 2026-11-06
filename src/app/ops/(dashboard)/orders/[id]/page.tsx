import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrderDetail } from '@/lib/admin/queries';
import { hasRole } from '@/lib/auth/session';
import { requireAdmin } from '@/lib/auth/guards';
import { reconcileOrderAction, refundOrderAction, retryFulfilmentAction, retryWebhookAction, syncRefundAction } from '../../../actions';
import { ActionForm } from '../../../_components/ActionForm';
import { ConfirmButton } from '../../../_components/controls';
import { Icon } from '../../../_components/icons';
import { Alert, BackLink, Badge, Card, EmptyState, Flash, fmtDate, KV, label, money, PageHeader, type SP } from '../../../_components/ui';

// Human-readable names for order timeline events (unknown types fall back to a cleaned-up label).
// "marked as sent" is deliberate: for imported legacy orders those steps were recorded but never delivered.
const EVENT_LABEL: Record<string, string> = {
  created: 'Order created',
  cashfree_session_created: 'Cashfree checkout opened',
  cashfree_create_failed: 'Cashfree checkout could not be created',
  paid: 'Payment verified',
  payment_failed: 'Payment failed',
  payment_dropped: 'Checkout closed by customer',
  late_failed_ignored: 'Late failure ignored (already paid)',
  late_dropped_ignored: 'Late drop ignored (already paid)',
  duplicate_success_ignored: 'Duplicate payment event ignored',
  amount_mismatch: 'Amount or currency mismatch',
  reconciled: 'Checked with Cashfree',
  fulfil_confirmationSentAt: 'Confirmation marked as sent',
  fulfil_zoomSentAt: 'Zoom link marked as sent',
  fulfil_crmSyncedAt: 'CRM marked as synced',
  fulfil_error: 'Delivery step failed',
  refund_requested: 'Refund requested',
  refund_pending: 'Refund pending at Cashfree',
  refund_onhold: 'Refund on hold',
  refund_success: 'Refund completed',
  refund_failed: 'Refund failed',
  refund_cancelled: 'Refund cancelled',
  refund_status_regression_ignored: 'Out-of-order refund update ignored',
  imported_from_legacy_json: 'Imported from the legacy store',
  legacy_fulfilment_corrected: 'Delivery status corrected',
};
const eventLabel = (type: string) => EVENT_LABEL[type] ?? label(type).replace(/^\w/, (c) => c.toUpperCase());

const tone = (type: string) => (/paid|success|reconciled|fulfil_/.test(type) ? 'ok' : /fail|mismatch|error|dropped/.test(type) ? 'bad' : /refund|corrected|late|duplicate/.test(type) ? 'warn' : undefined);

export default async function OrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const admin = await requireAdmin('VIEWER');
  const { id } = await params;
  const sp = await searchParams;
  const o = await getOrderDetail(id);
  if (!o) notFound();
  const here = `/ops/orders/${o.id}`;
  const canAct = hasRole(admin, 'ADMIN');
  const lineItems = o.lineItems as { label: string; amountPaise: number }[];
  const activeRefund = o.refunds.find((r) => r.status === 'PENDING' || r.status === 'ONHOLD' || r.status === 'SUCCESS');
  const canRefund = canAct && o.status === 'PAID' && !activeRefund;
  const delivered = (d: Date | null) => (d ? <Badge tone="ok">sent {fmtDate(d)}</Badge> : <Badge tone="bad">not delivered</Badge>);

  return (
    <>
      <PageHeader
        title={`Order ${o.orderNumber}`}
        description={<>Created {fmtDate(o.createdAt)} · {o.provider.toLowerCase()} ({o.providerMode})</>}
        actions={
          <>
            <BackLink href="/ops/orders">Orders</BackLink>
            {canAct && o.status === 'PENDING' && o.provider === 'CASHFREE' && <ActionForm action={reconcileOrderAction} fields={{ orderId: o.id }} returnTo={here} label={<><Icon name="refresh" size={15} /> Check with Cashfree</>} pendingLabel="Checking…" />}
            {canAct && o.status === 'PAID' && (
              <ActionForm
                action={retryFulfilmentAction}
                fields={{ orderId: o.id }}
                returnTo={here}
                label={<><Icon name="send" size={15} /> Retry confirmation / Zoom / CRM</>}
                confirm={{ title: 'Send delivery messages?', message: `This will (re)send the confirmation and Zoom link to ${o.customerName} for any step not yet delivered, and sync the CRM.`, confirmLabel: 'Send now' }}
              />
            )}
          </>
        }
      />
      <Flash msg={sp.msg} err={sp.err} />

      <div className="o-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="o-card o-stat"><span className="o-stat-label">Status</span><div className="o-stat-value" style={{ fontSize: 18 }}><Badge value={o.status} /></div></div>
        <div className="o-card o-stat"><span className="o-stat-label">Amount</span><div className="o-stat-value">{money(o.amountPaise)}</div><div className="o-stat-note">{o.currency}</div></div>
        <div className="o-card o-stat"><span className="o-stat-label">Paid at</span><div className="o-stat-value" style={{ fontSize: 16 }}>{fmtDate(o.paidAt)}</div></div>
        <div className="o-card o-stat"><span className="o-stat-label">Cashfree order</span><div className="o-stat-value o-mono" style={{ fontSize: 15 }}>{o.providerOrderId ?? '—'}</div></div>
      </div>

      {o.fulfilmentError && <div className="o-flash"><Alert tone="warn" title="Delivery incomplete">{o.fulfilmentError}</Alert></div>}

      <div className="o-grid-main">
        <div className="o-stack">
          <Card title="Delivery" description="Confirmation, Zoom link and CRM sync after a verified payment">
            <div className="o-delivery">
              <div className="o-delivery-item"><span className="o-label">Confirmation</span>{delivered(o.confirmationSentAt)}</div>
              <div className="o-delivery-item"><span className="o-label">Zoom link</span>{delivered(o.zoomSentAt)}</div>
              <div className="o-delivery-item"><span className="o-label">CRM sync</span>{o.crmSyncedAt ? <Badge tone="ok">synced</Badge> : <Badge tone="bad">not synced</Badge>}</div>
            </div>
          </Card>

          <Card title="Payments" description="Every attempt reported by the payment provider" flush>
            {o.payments.length === 0 ? (
              <EmptyState icon="currency" title="No payment attempts yet" />
            ) : (
              <div className="o-table-wrap">
                <table className="o-table">
                  <thead><tr><th>Payment id</th><th>Status</th><th className="o-num">Amount</th><th className="o-hide-sm">Method</th><th className="o-hide-sm">Date</th></tr></thead>
                  <tbody>
                    {o.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="o-mono">{p.providerPaymentId}{p.message && <span className="o-cell-sub">{p.message}</span>}</td>
                        <td><Badge value={p.status} /></td>
                        <td className="o-num">{money(p.amountPaise)}</td>
                        <td className="o-hide-sm" style={{ textTransform: 'capitalize' }}>{p.method ?? '—'}</td>
                        <td className="o-hide-sm o-nowrap">{fmtDate(p.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Refunds" flush>
            {o.refunds.length === 0 ? (
              <EmptyState icon="refunds" title="No refunds">{canRefund ? 'Use the refund form to return the full amount through Cashfree.' : undefined}</EmptyState>
            ) : (
              <div className="o-table-wrap">
                <table className="o-table">
                  <thead><tr><th>Refund</th><th>Status</th><th className="o-num">Amount</th><th className="o-hide-sm">Requested by</th><th /></tr></thead>
                  <tbody>
                    {o.refunds.map((r) => (
                      <tr key={r.id}>
                        <td className="o-mono">{r.refundNumber}<span className="o-cell-sub">{fmtDate(r.createdAt)}{r.providerRefundId ? ` · Cashfree ${r.providerRefundId}` : ''}</span></td>
                        <td><Badge value={r.status} />{r.failureReason && <span className="o-cell-sub" style={{ color: 'var(--o-bad)' }}>{r.failureReason}</span>}</td>
                        <td className="o-num">{money(r.amountPaise)}</td>
                        <td className="o-hide-sm">{r.requestedBy?.name ?? 'Cashfree portal'}<span className="o-cell-sub">{r.reason}</span></td>
                        <td>{canAct && (r.status === 'PENDING' || r.status === 'ONHOLD') && <div className="o-table-actions"><ActionForm action={syncRefundAction} fields={{ refundId: r.id }} returnTo={here} label="Sync status" pendingLabel="Syncing…" /></div>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Webhook events" flush>
            {o.webhookEvents.length === 0 ? (
              <EmptyState icon="webhooks" title="No webhook events linked" />
            ) : (
              <div className="o-table-wrap">
                <table className="o-table">
                  <thead><tr><th>Event</th><th>Status</th><th className="o-hide-sm">Attempts</th><th /></tr></thead>
                  <tbody>
                    {o.webhookEvents.map((w) => (
                      <tr key={w.id}>
                        <td><span className="o-cell-title">{w.eventType}</span><span className="o-cell-sub">{fmtDate(w.receivedAt)}{w.lastError ? ` · ${w.lastError}` : ''}</span></td>
                        <td><Badge value={w.status} /></td>
                        <td className="o-hide-sm">{w.attempts}</td>
                        <td>{canAct && w.status === 'FAILED' && <div className="o-table-actions"><ActionForm action={retryWebhookAction} fields={{ eventId: w.id }} returnTo={here} label="Retry" pendingLabel="Retrying…" /></div>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="o-stack">
          <Card title="Customer">
            <KV items={[['Name', o.customerName], ['Email', <a key="e" href={`mailto:${o.customerEmail}`}>{o.customerEmail}</a>], ['Phone', o.customerPhone], ['Lead', <Link key="l" href={`/ops/leads/${o.leadId}`}>View lead</Link>], ['Terms', `v${o.termsVersion}, accepted ${fmtDate(o.termsAcceptedAt)}`]]} />
          </Card>
          <Card title="Order details">
            <KV items={[['Cohort', <Link key="c" href={`/ops/workshops/${o.cohort.id}`}>{o.cohort.title}</Link>], ...lineItems.map((l): [string, string] => [l.label, money(l.amountPaise)]), ['Total', <strong key="t">{money(o.amountPaise)}</strong>]]} />
          </Card>

          {canRefund && (
            <Card title="Issue refund" description="Full refund through Cashfree. One refund per order.">
              <form action={refundOrderAction} className="o-form">
                <input type="hidden" name="orderId" value={o.id} />
                <input type="hidden" name="returnTo" value={here} />
                <div className="o-field">
                  <label htmlFor="reason">Reason</label>
                  <textarea className="o-textarea" id="reason" name="reason" required minLength={5} maxLength={300} rows={3} placeholder="Kept in the audit log" />
                </div>
                <label className="o-check">
                  <input type="checkbox" name="confirm" required />
                  <span>Send {money(o.amountPaise)} back to the customer via Cashfree.</span>
                </label>
                <ConfirmButton variant="danger-outline" tone="danger" title="Refund this order?" message={`${money(o.amountPaise)} will be refunded to ${o.customerName} through Cashfree. This cannot be undone.`} confirmLabel="Refund now">
                  Request refund
                </ConfirmButton>
              </form>
            </Card>
          )}

          <Card title="Timeline">
            <ol className="o-timeline">
              {o.events.map((e) => (
                <li key={e.id} data-tone={tone(e.type)}>
                  <div className="o-timeline-title">{eventLabel(e.type)}</div>
                  <div className="o-timeline-meta">{fmtDate(e.createdAt)}{e.detail ? ` · ${e.detail}` : ''}</div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
