import type { MetadataRoute } from 'next';
import { getArticles } from '@/lib/cms';
import { siteUrl } from '@/lib/seo';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = ['', '/about', '/programs', '/workshop', '/level-zero', '/mentorship', '/free-training', '/results', '/insights', '/contact', '/privacy-policy', '/terms-and-conditions', '/refund-policy'];
  const now = new Date();
  const articles = await getArticles();
  return [
    ...routes.map((r) => ({ url: `${siteUrl}${r}`, lastModified: now, changeFrequency: 'weekly' as const, priority: r === '' ? 1 : 0.7 })),
    ...articles.map((a) => ({ url: `${siteUrl}/insights/${a.slug}`, lastModified: new Date(a.publishedAt), changeFrequency: 'monthly' as const, priority: 0.5 })),
  ];
}
