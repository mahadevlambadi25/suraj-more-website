import type { SiteSettings } from '@/lib/types';

// ⚠ PRE-LAUNCH: every value marked TODO must be confirmed by Suraj in writing (brief §8).
export const settings: SiteSettings = {
  brandName: 'Suraj More', // TODO confirm spelling: "More" vs "Morey" (issue #2)
  wordmark: 'SURAJ MORE', // TODO confirm lock-up: SURAJ MORE vs HIGH TICKET SYNDICATE
  founderName: 'Suraj More',
  founderTitle: 'Premium Sales Coach',
  positioningLine:
    'Practical high-ticket sales coaching for coaches, consultants and agency owners who want better sales conversations and a repeatable conversion system.',
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
  headerCta: { label: 'Watch Free Training', href: '/free-training' },
  legalEntity: null, // TODO set after verification (issue #3, #10)
  founder: {
    portrait: null, // TODO: { src: '/images/suraj-hero.jpg', width: 1200, height: 1500, alt: 'Suraj More' }
    shortBio: [
      'Suraj has spent his career in live sales conversations — leading them, reviewing them and teaching others how to run them with more clarity and less pressure.',
      'His work today focuses on one thing: helping coaches, consultants and agency owners lead qualified sales conversations with structure, so good offers stop leaking at the call stage.',
    ],
  },
  freeTraining: {
    headline: 'The free training: how to lead a high-trust sales conversation',
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
      'Practical high-ticket sales coaching for coaches, consultants and agency owners. Lead better sales conversations with a repeatable conversion system.',
    ogImage: '/og-default.png',
  },
};
