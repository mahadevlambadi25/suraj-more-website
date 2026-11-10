import { notFound } from 'next/navigation';
import { getCaseStudy } from '@/lib/admin/queries';
import { hasRole } from '@/lib/auth/session';
import { requireAdmin } from '@/lib/auth/guards';
import { deleteCaseStudyAction } from '../../../../actions';
import { ActionForm } from '../../../../_components/ActionForm';
import { BackLink, Badge, Card, Flash, PageHeader, type SP } from '../../../../_components/ui';
import { CaseStudyForm } from '../../ProofForms';

export default async function CaseStudyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const admin = await requireAdmin('VIEWER');
  const { id } = await params;
  const sp = await searchParams;
  const item = await getCaseStudy(id);
  if (!item) notFound();
  const canEdit = hasRole(admin, 'ADMIN');
  const live = item.status === 'PUBLISHED' && item.permissionOnFile;
  return (
    <>
      <PageHeader
        title={item.client}
        description={<>Case study · {live ? <Badge tone="ok">PUBLISHED</Badge> : <Badge tone="muted">DRAFT</Badge>}</>}
        actions={<BackLink href="/ops/proof">Proof</BackLink>}
      />
      <Flash msg={sp.msg} err={sp.err} />
      <div style={{ maxWidth: 860, display: 'grid', gap: 20 }}>
        <Card title={canEdit ? undefined : 'Details'} description={canEdit ? undefined : 'Read-only for your role.'}>
          <CaseStudyForm item={item} readOnly={!canEdit} />
        </Card>
        {canEdit && (
          <Card title="Delete" description="Removes this case study from the website and the dashboard. This cannot be undone.">
            <ActionForm
              action={deleteCaseStudyAction}
              fields={{ caseStudyId: item.id }}
              returnTo={`/ops/proof/case-studies/${item.id}`}
              variant="danger-outline"
              label="Delete case study"
              confirm={{ title: `Delete the case study for ${item.client}?`, message: 'It will disappear from the website immediately. This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' }}
            />
          </Card>
        )}
      </div>
    </>
  );
}
