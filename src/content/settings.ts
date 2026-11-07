import type { SiteSettings } from '@/lib/types';

// ⚠ PRE-LAUNCH: every value marked TODO / [[CONFIRM]] must be confirmed by Suraj in writing (brief §8).
// Full list of open confirmations: docs/CONTENT_CONFIRMATIONS.md
// Contact email, WhatsApp number and the Whop URL can also be set without a deploy in /ops → Settings
// (those values override the defaults below).
export const settings: SiteSettings = {
  brandName: 'Suraj More', // TODO confirm spelling: "More" vs "Morey" (issue #2)
  wordmark: 'SURAJ MORE', // TODO confirm lock-up: SURAJ MORE vs HIGH TICKET SYNDICATE
  founderName: 'Suraj More',
  founderTitle: 'Premium Sales Coach',
  positioningLine:
    'Practical high-ticket sales coaching for coaches, consultants and agency owners who want better sales conversations and a repeatable way to convert them.',
  contact: {
    email: 'hello@example.com', // TODO real support email
    whatsappNumber: '910000000000', // TODO real WhatsApp business number
    whatsappDisplay: '+91 00000 00000',
  },
  socials: [
    // Only add confirmed profiles, e.g. { label: 'Instagram', href: 'https://instagram.com/...' }
  ],
  nav: [
    { label: 'About', href: '/about' },
    { label: 'Programs', href: '/programs' },
    { label: 'Results', href: '/results' },
    { label: 'Insights', href: '/insights' },
    { label: 'Contact', href: '/contact' },
  ],
  headerCta: { label: 'Watch the Free Training', href: '/free-training' },
  legalEntity: null, // TODO set after verification (issue #3, #10)
  founder: {
    portrait: null, // TODO: { src: '/images/suraj-hero.jpg', width: 1200, height: 1500, alt: 'Suraj More' }
    // [[CONFIRM: 2–3 line approved bio from Suraj — background, years, roles]].
    // Until then only the positioning statement is shown; no career claims are published.
    shortBio: ['Suraj More helps coaches, consultants and agency owners lead qualified sales conversations with structure, not pressure.'],
  },
  freeTraining: {
    headline: 'How to lead a high-trust sales conversation',
    // TODO: real unlisted VSL, e.g. { provider: 'youtube', id: 'XXXXXXXXXXX', title: '...', captions: true }
    video: null,
  },
  levelZero: {
    joinUrl: 'https://whop.com/', // TODO exact Whop Level Zero URL
  },
  seo: {
    defaultTitle: 'Suraj More | Premium Sales Coach & Sales System Builder',
    titleTemplate: '%s | Suraj More',
    description:
      'High-ticket sales coaching for coaches, consultants and agency owners. Lead better sales conversations with a repeatable structure.',
    ogImage: '/og-default.png',
  },
};
