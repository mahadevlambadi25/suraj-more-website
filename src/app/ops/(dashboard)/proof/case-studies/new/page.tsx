import { requireAdmin } from '@/lib/auth/guards';
import { BackLink, Card, Flash, PageHeader, type SP } from '../../../../_components/ui';
import { CaseStudyForm } from '../../ProofForms';

export default async function NewCaseStudyPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin('ADMIN');
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="New case study" description="Client, starting point, intervention and a sourced outcome. Saved as a draft until permission is confirmed and you publish it." actions={<BackLink href="/ops/proof">Proof</BackLink>} />
      <Flash msg={sp.msg} err={sp.err} />
      <div style={{ maxWidth: 860 }}>
        <Card>
          <CaseStudyForm />
        </Card>
      </div>
    </>
  );
}
