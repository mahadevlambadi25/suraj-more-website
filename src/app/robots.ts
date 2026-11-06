import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/ops', '/go/', '/workshop/confirmation', '/workshop/checkout-mock', '/free-training/watch'] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
