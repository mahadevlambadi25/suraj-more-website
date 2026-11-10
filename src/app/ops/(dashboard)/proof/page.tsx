import Link from 'next/link';
import { listProof } from '@/lib/admin/queries';
import { hasRole } from '@/lib/auth/session';
import { requireAdmin } from '@/lib/auth/guards';
import { Icon } from '../../_components/icons';
import { Badge, Card, EmptyState, Flash, fmtDate, PageHeader, type SP } from '../../_components/ui';

// PRD §11.2 / §11.5: testimonials and case studies are managed here (no code deployment needed).
export default async function ProofPage({ searchParams }: { searchParams: SP }) {
  const admin = await requireAdmin('VIEWER');
  const sp = await searchParams;
  const canEdit = hasRole(admin, 'ADMIN');
  const { testimonials, caseStudies } = await listProof();
  const live = (p: { status: string; permissionOnFile: boolean }) => p.status === 'PUBLISHED' && p.permissionOnFile;
  const statusBadge = (p: { status: string; permissionOnFile: boolean }) =>
    live(p) ? <Badge tone="ok">PUBLISHED</Badge> : <Badge tone="muted">DRAFT</Badge>;
  const action = (href: string) => (
    <Link href={href} className="o-btn o-btn--secondary o-btn--sm o-view-btn">
      {canEdit ? 'Edit' : 'View'} <span aria-hidden="true">→</span>
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Proof"
        description="Testimonials and case studies for the Home and Results pages. Only items marked Published with written permission on file appear on the website."
        actions={
          canEdit ? (
            <>
              <Link href="/ops/proof/testimonials/new" className="o-btn o-btn--secondary"><Icon name="plus" size={16} /> New testimonial</Link>
              <Link href="/ops/proof/case-studies/new" className="o-btn o-btn--primary"><Icon name="plus" size={16} /> New case study</Link>
            </>
          ) : undefined
        }
      />
      <Flash msg={sp.msg} err={sp.err} />

      <div className="o-stack">
        <Card title="Testimonials" description={`${testimonials.filter(live).length} of ${testimonials.length} live on the website`} flush>
          {testimonials.length === 0 ? (
            <EmptyState icon="user" title="No testimonials yet">Add one when you have the client’s written permission and exact approved wording.</EmptyState>
          ) : (
            <div className="o-table-wrap">
              <table className="o-table">
                <thead><tr><th>Client</th><th className="o-hide-md">Verification</th><th className="o-hide-md">Status</th><th className="o-hide-md">Updated</th><th className="o-num"><span className="o-sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {testimonials.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/ops/proof/testimonials/${t.id}`} className="o-row-link">{t.client}</Link>
                        <span className="o-cell-sub">{t.role} · {t.niche}</span>
                        <span className="o-show-md o-cell-meta">{statusBadge(t)}{!t.permissionOnFile && <span>No permission on file</span>}</span>
                      </td>
                      <td className="o-hide-md o-small">{t.verification === 'INDEPENDENTLY_VERIFIED' ? 'Independently verified' : 'Client-reported'}</td>
                      <td className="o-hide-md">{statusBadge(t)}{!t.permissionOnFile && <span className="o-cell-sub">No permission on file</span>}</td>
                      <td className="o-hide-md o-nowrap">{fmtDate(t.updatedAt)}</td>
                      <td className="o-num">{action(`/ops/proof/testimonials/${t.id}`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Case studies" description={`${caseStudies.filter(live).length} of ${caseStudies.length} live on the website`} flush>
          {caseStudies.length === 0 ? (
            <EmptyState icon="inbox" title="No case studies yet">Each case study needs a starting point, intervention, and an outcome with baseline, period and source.</EmptyState>
          ) : (
            <div className="o-table-wrap">
              <table className="o-table">
                <thead><tr><th>Client</th><th className="o-hide-md">Outcome</th><th className="o-hide-md">Status</th><th className="o-hide-md">Updated</th><th className="o-num"><span className="o-sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {caseStudies.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/ops/proof/case-studies/${c.id}`} className="o-row-link">{c.client}</Link>
                        <span className="o-cell-sub">{c.role}</span>
                        <span className="o-show-md o-cell-meta">{statusBadge(c)}{!c.permissionOnFile && <span>No permission on file</span>}</span>
                      </td>
                      <td className="o-hide-md o-small">{c.outcomeMetric}: {c.outcomeBaseline} → {c.outcomeResult} ({c.outcomePeriod})</td>
                      <td className="o-hide-md">{statusBadge(c)}{!c.permissionOnFile && <span className="o-cell-sub">No permission on file</span>}</td>
                      <td className="o-hide-md o-nowrap">{fmtDate(c.updatedAt)}</td>
                      <td className="o-num">{action(`/ops/proof/case-studies/${c.id}`)}</td>
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
