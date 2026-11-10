import { requireAdmin } from '@/lib/auth/guards';
import { BackLink, Card, Flash, PageHeader, type SP } from '../../../../_components/ui';
import { TestimonialForm } from '../../ProofForms';

export default async function NewTestimonialPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin('ADMIN');
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="New testimonial" description="Saved as a draft until written permission is confirmed and you publish it." actions={<BackLink href="/ops/proof">Proof</BackLink>} />
      <Flash msg={sp.msg} err={sp.err} />
      <div style={{ maxWidth: 860 }}>
        <Card>
          <TestimonialForm />
        </Card>
      </div>
    </>
  );
}
