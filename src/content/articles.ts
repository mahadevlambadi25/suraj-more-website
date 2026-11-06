import type { Article } from '@/lib/types';

// TODO: all article copy to be reviewed and approved by Suraj before launch.
export const articles: Article[] = [
  {
    slug: 'why-prospects-say-i-need-to-think-about-it',
    title: 'Why prospects say “I need to think about it” — and what it really means',
    excerpt:
      '“I need to think about it” is rarely about time. It is a signal that one kind of certainty is missing. Here is how to find which one.',
    kind: 'framework',
    author: 'Suraj More',
    publishedAt: '2026-10-20',
    readingMinutes: 5,
    body: [
      { type: 'p', text: 'Most people hear “I need to think about it” as a polite no. Sometimes it is. More often it means the prospect is interested but uncertain — and they do not know how to say what they are uncertain about.' },
      { type: 'h2', text: 'Three certainties every buyer needs' },
      { type: 'list', items: ['Certainty that the problem is worth solving now.', 'Certainty that this solution fits their situation.', 'Certainty that they can follow through.'] },
      { type: 'p', text: 'If any one of these is missing, the safest move for them is to delay. Pushing harder does not create certainty — it creates resistance.' },
      { type: 'h2', text: 'Ask, do not argue' },
      { type: 'p', text: 'Instead of overcoming the objection, clarify it: “Of course. So I can help — what part do you want to think through?” The answer tells you which certainty is missing.' },
      { type: 'quote', text: 'The goal is not to become pushy. It is to lead a better sales conversation.' },
    ],
  },
  {
    slug: 'diagnose-before-you-prescribe',
    title: 'Diagnose before you prescribe: the Doctor Frame',
    excerpt: 'Why the expert who asks better questions earns more trust than the one who pitches harder.',
    kind: 'article',
    author: 'Suraj More',
    publishedAt: '2026-10-06',
    readingMinutes: 4,
    body: [
      { type: 'p', text: 'Imagine a doctor who prescribes medicine before asking a single question. You would not trust them, however confident they sounded. Yet many sales calls start exactly like that.' },
      { type: 'h2', text: 'Examine first' },
      { type: 'p', text: 'Your first job on a call is to understand the situation precisely: what is happening, what they have tried, and what it is costing them.' },
      { type: 'h2', text: 'Reflect, then diagnose' },
      { type: 'p', text: 'Play back what you heard. When a prospect feels understood, your diagnosis lands as insight rather than as a pitch.' },
    ],
  },
  {
    slug: 'follow-up-leakage',
    title: 'Follow-up leakage: where good pipelines quietly lose deals',
    excerpt: 'The deals you lose after the call are usually lost because nothing clear was agreed on the call.',
    kind: 'article',
    author: 'Suraj More',
    publishedAt: '2026-09-22',
    readingMinutes: 4,
    body: [
      { type: 'p', text: 'A strong call followed by a vague “I’ll send you the details” is one of the most common ways qualified opportunities go cold.' },
      { type: 'h2', text: 'Agree the next step on the call' },
      { type: 'p', text: 'Before you end, agree a specific next step with a date and an owner. Follow-up then becomes keeping a promise, not chasing.' },
    ],
  },
];
