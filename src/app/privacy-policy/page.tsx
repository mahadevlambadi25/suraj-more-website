import { LegalPage } from '@/components/LegalPage';
import { getLegalDoc } from '@/lib/cms';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({ title: 'Privacy Policy', description: 'How we collect, use and protect personal data.', path: '/privacy-policy' });

export default async function Page() {
  return <LegalPage doc={await getLegalDoc('privacy-policy')} />;
}
