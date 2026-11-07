import Link from 'next/link';
import { applicationStatusCounts } from '@/lib/admin/dashboard';
import { listApplications } from '@/lib/admin/queries';
import { requireAdmin } from '@/lib/auth/guards';
import { TIMELINES } from '@/lib/validation';
import { Badge, Card, EmptyState, fmtDate, PageHeader, Pager, Segments, type SP } from '../../_components/ui';

const STATUSES = ['new', 'accepted', 'rejected'];

export default async function ApplicationsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin('VIEWER');
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status ?? '') ? sp.status : undefined;
  const [{ rows, total, page, pages }, counts] = await Promise.all([listApplications({ status, page: Number(sp.page) || 1 }), applicationStatusCounts()]);
  const timeline = (v: string) => TIMELINES.find((t) => t.value === v)?.label ?? v;

  return (
    <>
      <PageHeader title="Mentorship applications" description="Review each application and decide. The booking link is emailed only after you accept." />
      <Card flush>
        <div className="o-toolbar">
          <Segments base="/ops/applications" current={status} items={[['', 'All', counts.all], ['new', 'Awaiting decision', counts.new], ['accepted', 'Accepted', counts.accepted], ['rejected', 'Rejected', counts.rejected]]} />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon="mentorship" title={status ? `No ${status === 'new' ? 'applications awaiting a decision' : `${status} applications`}` : 'No applications yet'}>
            {status === 'new' ? 'You’re all caught up.' : 'Applications appear when someone completes the form on the Mentorship page.'}
          </EmptyState>
        ) : (
          <div className="o-table-wrap">
            <table className="o-table">
              <thead><tr><th>Applicant</th><th className="o-hide-sm">Offer</th><th className="o-hide-md">Timeline</th><th className="o-hide-md">Status</th><th className="o-hide-md">Received</th><th className="o-num"><span className="o-sr-only">Actions</span></th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/ops/applications/${a.id}`} className="o-row-link">{a.name}</Link>
                      <span className="o-cell-sub o-break">{a.email}</span>
                      <span className="o-show-md o-cell-meta"><Badge value={a.status}>{a.status}</Badge><span>{fmtDate(a.createdAt)}</span></span>
                    </td>
                    <td className="o-hide-sm" style={{ maxWidth: 420 }}>{a.offer.length > 120 ? `${a.offer.slice(0, 120)}…` : a.offer}</td>
                    <td className="o-hide-md o-small">{timeline(a.timeline)}</td>
                    <td className="o-hide-md"><Badge value={a.status}>{a.status}</Badge></td>
                    <td className="o-hide-md o-nowrap">{fmtDate(a.createdAt)}</td>
                    <td className="o-num">
                      <Link href={`/ops/applications/${a.id}`} className="o-btn o-btn--secondary o-btn--sm o-view-btn" aria-label={`View details for ${a.name}`}>
                        View Details <span aria-hidden="true">→</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pages={pages} total={total} unit={total === 1 ? 'application' : 'applications'} base="/ops/applications" params={{ status }} />
      </Card>
    </>
  );
}
