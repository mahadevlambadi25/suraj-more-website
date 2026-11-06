import { LegalPage } from '@/components/LegalPage';
import { getLegalDoc } from '@/lib/cms';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({ title: 'Refund Policy', description: 'Cancellation and refund terms for our programs.', path: '/refund-policy' });

export default async function Page() {
  return <LegalPage doc={await getLegalDoc('refund-policy')} />;
}
