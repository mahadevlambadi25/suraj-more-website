import { notFound } from 'next/navigation';
import { getTestimonial } from '@/lib/admin/queries';
import { hasRole } from '@/lib/auth/session';
import { requireAdmin } from '@/lib/auth/guards';
import { deleteTestimonialAction } from '../../../../actions';
import { ActionForm } from '../../../../_components/ActionForm';
import { BackLink, Badge, Card, Flash, PageHeader, type SP } from '../../../../_components/ui';
import { TestimonialForm } from '../../ProofForms';

export default async function TestimonialPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const admin = await requireAdmin('VIEWER');
  const { id } = await params;
  const sp = await searchParams;
  const item = await getTestimonial(id);
  if (!item) notFound();
  const canEdit = hasRole(admin, 'ADMIN');
  const live = item.status === 'PUBLISHED' && item.permissionOnFile;
  return (
    <>
      <PageHeader
        title={item.client}
        description={<>Testimonial · {live ? <Badge tone="ok">PUBLISHED</Badge> : <Badge tone="muted">DRAFT</Badge>}</>}
        actions={<BackLink href="/ops/proof">Proof</BackLink>}
      />
      <Flash msg={sp.msg} err={sp.err} />
      <div style={{ maxWidth: 860, display: 'grid', gap: 20 }}>
        <Card title={canEdit ? undefined : 'Details'} description={canEdit ? undefined : 'Read-only for your role.'}>
          <TestimonialForm item={item} readOnly={!canEdit} />
        </Card>
        {canEdit && (
          <Card title="Delete" description="Removes this testimonial from the website and the dashboard. This cannot be undone.">
            <ActionForm
              action={deleteTestimonialAction}
              fields={{ testimonialId: item.id }}
              returnTo={`/ops/proof/testimonials/${item.id}`}
              variant="danger-outline"
              label="Delete testimonial"
              confirm={{ title: `Delete the testimonial from ${item.client}?`, message: 'It will disappear from the website immediately. This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' }}
            />
          </Card>
        )}
      </div>
    </>
  );
}
