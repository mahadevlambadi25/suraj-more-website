import type { Metadata } from 'next';
import { settings } from '@/content/settings';
import type { Article, PublicCohort } from './types';

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export function pageMeta(opts: { title: string; description: string; path: string; absoluteTitle?: boolean; noindex?: boolean }): Metadata {
  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: {
      title: opts.absoluteTitle ? opts.title : `${opts.title} | ${settings.brandName}`,
      description: opts.description,
      url: opts.path,
      siteName: settings.brandName,
      type: 'website',
      locale: 'en_IN',
    },
    twitter: { card: 'summary_large_image' },
    robots: opts.noindex ? { index: false, follow: false } : undefined,
  };
}

export function personSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: settings.founderName,
    jobTitle: settings.founderTitle,
    url: siteUrl,
    description: settings.positioningLine,
    ...(settings.founder.portrait ? { image: `${siteUrl}${settings.founder.portrait.src}` } : {}),
    sameAs: settings.socials.map((s) => s.href),
  };
}

/** Course + Event schema — emitted only while a cohort is active, so it disappears automatically when expired. */
export function workshopSchemas(cohort: PublicCohort, soldOut = false) {
  const availability = soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock';
  const url = `${siteUrl}/workshop/${cohort.slug}`;
  const course = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: 'The One Skill Workshop',
    description: 'A two-day live workshop on leading sales conversations with certainty instead of pressure.',
    provider: { '@type': 'Person', name: settings.founderName, url: siteUrl },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      startDate: cohort.startsAt,
      endDate: cohort.endsAt,
      location: { '@type': 'VirtualLocation', url },
    },
    offers: { '@type': 'Offer', price: cohort.priceInr, priceCurrency: 'INR', availability, url, category: 'Paid' },
  };
  const event = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: cohort.title,
    startDate: cohort.startsAt,
    endDate: cohort.endsAt,
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: { '@type': 'VirtualLocation', url },
    organizer: { '@type': 'Person', name: settings.founderName, url: siteUrl },
    offers: { '@type': 'Offer', price: cohort.priceInr, priceCurrency: 'INR', availability, url, validFrom: new Date().toISOString().slice(0, 10) },
  };
  return [course, event];
}

export function articleSchema(a: Article) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.excerpt,
    datePublished: a.publishedAt,
    author: { '@type': 'Person', name: a.author, url: `${siteUrl}/about` },
    mainEntityOfPage: `${siteUrl}/insights/${a.slug}`,
  };
}
