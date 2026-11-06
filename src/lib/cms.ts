// CMS adapter. Pages ONLY read content through these async functions,
// so swapping local content for Sanity (or another headless CMS) is a one-file change.
import 'server-only';
import { articles } from '@/content/articles';
import { faqs } from '@/content/faqs';
import { frameworks } from '@/content/frameworks';
import { legalDocs } from '@/content/legal';
import { programs } from '@/content/programs';
import { caseStudies, testimonials, trustPoints } from '@/content/proof';
import { findActiveCohortRow, findCohortRow, toCohort, toPublicCohort } from './cohorts';
import { formatInr } from './format';
import { getMergedSettings } from './settings';
import type { Cohort, LegalDoc, Program, ProgramId, PublicCohort } from './types';

export { isCohortPurchasable } from './cohorts';

export async function getSettings() {
  return getMergedSettings();
}

/**
 * Active cohort comes from the database (managed in /ops/workshops).
 * If the database is unreachable we fail SAFE: no cohort → waitlist shown, nothing purchasable.
 */
export async function getActiveCohort(now = Date.now()): Promise<PublicCohort | null> {
  try {
    const row = await findActiveCohortRow(now);
    return row ? toPublicCohort(toCohort(row)) : null;
  } catch (err) {
    console.error('[cms] active cohort unavailable', err instanceof Error ? err.message : err);
    return null;
  }
}

/** Server-only: full cohort record (used by checkout + fulfilment). Never includes Zoom details. */
export async function getCohortById(id: string): Promise<Cohort | null> {
  const row = await findCohortRow(id);
  return row ? toCohort(row) : null;
}

export async function getPrograms(): Promise<Program[]> {
  const cohort = await getActiveCohort();
  return programs.map((p) => {
    if (p.id !== 'workshop') return p;
    return cohort
      ? { ...p, status: 'open' as const, priceLabel: formatInr(cohort.priceInr), cta: { label: 'Reserve Workshop Seat', href: '/workshop' } }
      : { ...p, status: 'waitlist' as const, priceLabel: null, cta: { label: 'Join the waitlist', href: '/workshop#waitlist' } };
  });
}

export async function getProgram(id: ProgramId) {
  return (await getPrograms()).find((p) => p.id === id)!;
}

export async function getFrameworks() {
  return frameworks;
}

export async function getFaqs() {
  return faqs;
}

export async function getPublishedTestimonials() {
  return testimonials.filter((t) => t.status === 'published' && t.permissionOnFile);
}

export async function getPublishedCaseStudies() {
  return caseStudies.filter((c) => c.status === 'published' && c.permissionOnFile);
}

export async function getTrustPoints() {
  return trustPoints.filter((t) => t.approved).map((t) => t.label);
}

export async function getArticles() {
  return [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function getArticle(slug: string) {
  return articles.find((a) => a.slug === slug) ?? null;
}

export async function getLegalDoc(slug: LegalDoc['slug']) {
  return legalDocs.find((d) => d.slug === slug)!;
}
