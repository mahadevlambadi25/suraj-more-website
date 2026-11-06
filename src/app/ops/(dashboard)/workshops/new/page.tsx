import { requireAdmin } from '@/lib/auth/guards';
import { BackLink, Card, Flash, PageHeader, type SP } from '../../../_components/ui';
import { CohortForm } from '../CohortForm';

export default async function NewCohortPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin('ADMIN');
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="New cohort" description="Set dates, pricing and the private Zoom link. Save as Draft until everything is confirmed." actions={<BackLink href="/ops/workshops">Workshops</BackLink>} />
      <Flash msg={sp.msg} err={sp.err} />
      <div style={{ maxWidth: 860 }}>
        <Card>
          <CohortForm />
        </Card>
      </div>
    </>
  );
}
