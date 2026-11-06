import Link from 'next/link';
import { webhookStatusCounts } from '@/lib/admin/dashboard';
import { listWebhooks } from '@/lib/admin/queries';
import { hasRole } from '@/lib/auth/session';
import { requireAdmin } from '@/lib/auth/guards';
import { retryWebhookAction } from '../../actions';
import { ActionForm } from '../../_components/ActionForm';
import { Badge, Card, EmptyState, Flash, fmtDate, PageHeader, Pager, Segments, type SP } from '../../_components/ui';

const STATUSES = ['received', 'processed', 'failed', 'ignored'];

export default async function WebhooksPage({ searchParams }: { searchParams: SP }) {
  const admin = await requireAdmin('VIEWER');
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status ?? '') ? sp.status : undefined;
  const [{ rows, total, page, pages }, counts] = await Promise.all([listWebhooks({ status, page: Number(sp.page) || 1 }), webhookStatusCounts()]);
  const here = `/ops/webhooks${status ? `?status=${status}` : ''}`;
  const canAct = hasRole(admin, 'ADMIN');

  return (
    <>
      <PageHeader title="Webhooks" description="Payment events received from Cashfree. Retrying re-runs a stored, already-verified event — every state change is idempotent, so a retry can never double-charge or double-deliver." />
      <Flash msg={sp.msg} err={sp.err} />
      <Card flush>
        <div className="o-toolbar">
          <Segments
            base="/ops/webhooks"
            current={status}
            items={[
              ['', 'All', counts.all],
              ['failed', 'Failed', counts.failed],
              ['processed', 'Processed', counts.processed],
              ['received', 'Received', counts.received],
              ['ignored', 'Ignored', counts.ignored],
            ]}
          />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon="webhooks" title={status ? `No ${status} events` : 'No webhook events yet'}>
            {status === 'failed' ? 'Every received payment event was processed successfully.' : 'Events appear when Cashfree notifies the site about a payment or refund.'}
          </EmptyState>
        ) : (
          <div className="o-table-wrap">
            <table className="o-table">
              <thead><tr><th>Event</th><th>Status</th><th className="o-hide-sm">Order</th><th className="o-hide-sm">Attempts</th><th className="o-hide-sm">Received</th><th /></tr></thead>
              <tbody>
                {rows.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <span className="o-cell-title">{w.eventType}</span>
                      <span className="o-cell-sub o-mono" title={w.idempotencyKey}>{w.idempotencyKey.length > 32 ? `${w.idempotencyKey.slice(0, 32)}…` : w.idempotencyKey}</span>
                      <span className="o-cell-sub">{w.provider.toLowerCase()} · {w.signatureVerified ? 'signature verified' : 'simulated (mock)'}</span>
                      {w.lastError && <span className="o-cell-sub" style={{ color: 'var(--o-bad)' }}>{w.lastError}</span>}
                    </td>
                    <td><Badge value={w.status} /></td>
                    <td className="o-hide-sm">{w.orderId ? <Link href={`/ops/orders/${w.orderId}`} className="o-row-link o-mono">{w.orderNumber}</Link> : <span className="o-mono">{w.orderNumber ?? '—'}</span>}</td>
                    <td className="o-hide-sm">{w.attempts}</td>
                    <td className="o-hide-sm o-nowrap">{fmtDate(w.receivedAt)}{w.processedAt && <span className="o-cell-sub">processed {fmtDate(w.processedAt)}</span>}</td>
                    <td>{canAct && w.status === 'FAILED' && <div className="o-table-actions"><ActionForm action={retryWebhookAction} fields={{ eventId: w.id }} returnTo={here} label="Retry" pendingLabel="Retrying…" /></div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pages={pages} total={total} unit={total === 1 ? 'event' : 'events'} base="/ops/webhooks" params={{ status }} />
      </Card>
    </>
  );
}
