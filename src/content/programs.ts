import type { Program } from '@/lib/types';

// Offer ladder (brief §2). Workshop price/status is overridden at runtime by the active cohort.
// `summary` = page hero line · `ladderSummary` = short line on the offer-ladder cards (approved copy).
export const programs: Program[] = [
  {
    id: 'level-zero',
    title: 'Level Zero',
    tierLabel: 'Free · Start here',
    // [[CONFIRM: what Level Zero actually includes — the brief calls its role unclear]]
    summary: 'A free course and community covering the foundations of a structured sales conversation, before you invest in anything.',
    ladderSummary: 'The foundations of a structured sales conversation, in a free course and community.',
    audience: ['Coaches early in their sales journey', 'Sales professionals and closers', 'Anyone exploring Suraj’s approach'],
    format: 'Self-paced course + community (hosted on Whop)',
    curriculum: [
      'How a qualified sales conversation is structured',
      'Why prospects say “I need to think about it”',
      'The basics of discovery before you pitch',
    ],
    priceLabel: 'Free',
    status: 'open',
    cta: { label: 'Join for Free', href: '/level-zero' },
  },
  {
    id: 'workshop',
    title: 'The One Skill Workshop',
    tierLabel: 'Live workshop',
    summary: 'Two live days on the one skill that moves the most sales conversations forward: leading the call with certainty instead of pressure.',
    ladderSummary: 'Two live days on Zoom, practising the one skill that moves the most conversations forward.',
    audience: ['Coaches', 'Consultants', 'Sales professionals'],
    format: '2-day live workshop on Zoom',
    curriculum: [
      'Day 1, Intent: discovery that earns you the right to make an offer',
      'Day 2, Certainty → Close: handling hesitation without pushing',
      'Live role-play and Q&A',
    ],
    priceLabel: null, // set from the active cohort
    status: 'waitlist',
    cta: { label: 'Explore the Workshop', href: '/workshop' },
  },
  {
    id: 'mentorship',
    title: 'Premium Mentorship',
    tierLabel: 'Application only',
    summary: 'For consultants, coaches and agency owners with a proven offer who need a structured, repeatable sales process around it.',
    ladderSummary: 'Private advisory for established offers that need a repeatable sales process.',
    audience: [
      'You already have demand: qualified people are getting on calls',
      'You’re willing to have your real calls reviewed, and to practise',
      'Consultants, agency owners and established coaches with a high-ticket offer',
    ],
    format: 'Private mentorship — details shared after application',
    curriculum: [
      'An audit of your current sales conversations',
      'Installing the Sales Arm Framework in your calls',
      'Follow-up and pipeline structure',
    ],
    priceLabel: null, // brief: never publish until package, terms and delivery are confirmed
    status: 'application',
    cta: { label: 'Apply for Mentorship', href: '/mentorship' },
  },
  {
    id: 'inner-circle',
    title: 'VIP Advisory / Inner Circle',
    tierLabel: 'Advanced',
    summary: 'Coming soon. Details will be shared once confirmed.',
    audience: ['Past mentorship clients'],
    format: 'To be announced',
    curriculum: [],
    priceLabel: null,
    status: 'coming-soon',
    cta: { label: 'Not currently open', href: '/contact' },
  },
];
