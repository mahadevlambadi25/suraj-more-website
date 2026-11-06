import { LegalPage } from '@/components/LegalPage';
import { getLegalDoc } from '@/lib/cms';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({ title: 'Terms and Conditions', description: 'Terms for using this website and our programs.', path: '/terms-and-conditions' });

export default async function Page() {
  return <LegalPage doc={await getLegalDoc('terms-and-conditions')} />;
}
