import type { Program } from '@/lib/types';

// Offer ladder (brief §2). Workshop price/status is overridden at runtime by the active cohort.
export const programs: Program[] = [
  {
    id: 'level-zero',
    title: 'Level Zero',
    tierLabel: 'Free · Start here',
    summary:
      'A free course and community on Whop that gives you the foundations of a structured sales conversation before you invest in anything.',
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
    summary:
      'A two-day live Zoom workshop on the one skill that moves the most sales conversations forward — leading the call with certainty instead of pressure.',
    audience: ['Coaches (health, fitness, mindset and more)', 'Consultants', 'Sales professionals'],
    format: '2-day live workshop on Zoom',
    curriculum: [
      'Day 1 — Intent: discovery that earns the right to make an offer',
      'Day 2 — Certainty → Close: handling hesitation without pushing',
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
    summary:
      'Private advisory for consultants, coaches and agency owners with a proven offer who need a structured, repeatable sales process around it.',
    audience: ['Consultants and agency owners', 'Established coaches with a high-ticket offer'],
    format: 'Private mentorship — details shared after application',
    curriculum: [
      'Audit of your current sales conversations',
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
    summary: 'An advanced continuity tier for past mentorship clients. Details will be shared once confirmed.',
    audience: ['Past mentorship clients'],
    format: 'To be announced',
    curriculum: [],
    priceLabel: null,
    status: 'coming-soon',
    cta: { label: 'Not currently open', href: '/contact' },
  },
];
