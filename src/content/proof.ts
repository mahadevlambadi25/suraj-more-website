import type { CaseStudy, Testimonial } from '@/lib/types';

// Brief §7: publish ONLY with written permission, name/role attribution and exact approved wording.
// Set status: 'published' AND permissionOnFile: true for an item to appear anywhere.
export const testimonials: Testimonial[] = [
  {
    id: 'example-draft',
    quote: 'Exact approved wording goes here.',
    client: 'Client name',
    role: 'Role, Company',
    niche: 'Coach',
    permissionOnFile: false,
    verification: 'client-reported',
    status: 'draft',
  },
];

export const caseStudies: CaseStudy[] = [
  {
    id: 'example-draft',
    client: 'Client name',
    role: 'Consultant',
    permissionOnFile: false,
    startingPoint: 'Where they started (baseline).',
    intervention: 'What was implemented.',
    outcome: {
      metric: 'Close rate on qualified calls',
      baseline: 'x of y calls',
      result: 'x of y calls',
      period: '90 days',
      source: 'Client CRM export',
    },
    verification: 'client-reported',
    caveat: 'Individual result. Not typical and not guaranteed.',
    status: 'draft',
  },
];

/** Trust strip: only approved, substantiated proof points. Unverified claims (TEDx, 3,00,000+) stay out. */
export const trustPoints: { label: string; approved: boolean }[] = [
  { label: 'TEDx speaker', approved: false }, // issue #8 — needs event page link
  { label: '3,00,000+ sales conversations', approved: false }, // issue #8 — needs definition & proof
];
