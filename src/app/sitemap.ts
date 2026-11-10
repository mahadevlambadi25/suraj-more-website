import type { MetadataRoute } from 'next';
import { getArticles, getUpcomingCohorts } from '@/lib/cms';
import { siteUrl } from '@/lib/seo';

// Workshop dates come from the database — refresh hourly (saving a cohort in /ops also revalidates).
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = ['', '/about', '/programs', '/workshop', '/level-zero', '/mentorship', '/free-training', '/results', '/insights', '/contact', '/privacy-policy', '/terms-and-conditions', '/refund-policy'];
  const now = new Date();
  const [articles, cohorts] = await Promise.all([getArticles(), getUpcomingCohorts()]);
  return [
    ...routes.map((r) => ({ url: `${siteUrl}${r}`, lastModified: now, changeFrequency: 'weekly' as const, priority: r === '' ? 1 : 0.7 })),
    // Every published, upcoming workshop has its own page.
    ...cohorts.map((c) => ({ url: `${siteUrl}/workshop/${c.slug}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.8 })),
    ...articles.map((a) => ({ url: `${siteUrl}/insights/${a.slug}`, lastModified: new Date(a.publishedAt), changeFrequency: 'monthly' as const, priority: 0.5 })),
  ];
}
