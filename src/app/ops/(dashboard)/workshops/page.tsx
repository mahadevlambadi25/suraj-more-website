import Link from 'next/link';
import { listCohorts } from '@/lib/admin/queries';
import { hasRole } from '@/lib/auth/session';
import { requireAdmin } from '@/lib/auth/guards';
import { isCohortPurchasable } from '@/lib/cohorts';
import { Icon } from '../../_components/icons';
import { Badge, Card, EmptyState, Flash, fmtDate, money, PageHeader, type SP } from '../../_components/ui';

export default async function WorkshopsPage({ searchParams }: { searchParams: SP }) {
  const admin = await requireAdmin('VIEWER');
  const sp = await searchParams;
  const cohorts = await listCohorts();
  const canEdit = hasRole(admin, 'ADMIN');

  return (
    <>
      <PageHeader
        title="Workshops"
        description="Cohorts are the only source of workshop dates and prices. Closed or already-started cohorts can never be booked."
        actions={canEdit ? <Link href="/ops/workshops/new" className="o-btn o-btn--primary"><Icon name="plus" size={16} /> New cohort</Link> : undefined}
      />
      <Flash msg={sp.msg} err={sp.err} />
      <Card flush>
        {cohorts.length === 0 ? (
          <EmptyState icon="workshops" title="No cohorts yet" action={canEdit ? <Link href="/ops/workshops/new" className="o-btn o-btn--primary"><Icon name="plus" size={16} /> Create the first cohort</Link> : undefined}>
            Until a cohort is open, the website shows the waitlist instead of a checkout.
          </EmptyState>
        ) : (
          <div className="o-table-wrap">
            <table className="o-table">
              <thead>
                <tr><th>Cohort</th><th>Starts (IST)</th><th>Status</th><th className="o-hide-sm">Bookable</th><th className="o-num">Price</th><th className="o-num">Seats</th><th className="o-hide-sm">Zoom link</th></tr>
              </thead>
              <tbody>
                {cohorts.map((c) => {
                  const bookable = isCohortPurchasable(c);
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/ops/workshops/${c.id}`} className="o-row-link">{c.title}</Link>
                        <span className="o-cell-sub"><span className="o-mono">{c.slug}</span>{c.isSample && <> · <Badge tone="warn">sample</Badge></>}</span>
                      </td>
                      <td className="o-nowrap">{fmtDate(c.startsAt)}</td>
                      <td><Badge value={c.status} /></td>
                      <td className="o-hide-sm"><Badge tone={bookable ? 'ok' : 'muted'}>{bookable ? 'yes' : 'no'}</Badge></td>
                      <td className="o-num">{money(c.pricePaise)}{c.vipAddonActive && <span className="o-cell-sub">+ {money(c.vipAddonPricePaise)} VIP</span>}</td>
                      <td className="o-num">{c.confirmed}{c.seatLimit ? <span className="o-muted"> / {c.seatLimit}</span> : ''}</td>
                      <td className="o-hide-sm">{c.zoomJoinUrl ? <Badge tone="ok">set</Badge> : <Badge tone="bad">missing</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
