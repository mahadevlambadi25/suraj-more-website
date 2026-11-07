import type { Framework } from '@/lib/types';

// [[CONFIRM with Suraj: framework names, spellings and step wording]] (brief §7).
// Taglines + descriptions follow the approved copy document; step bodies are pending Suraj's review.
export const frameworks: Framework[] = [
  {
    id: 'sales-arm',
    name: 'Sales Arm Framework',
    tagline: 'The shape of the whole conversation',
    description: 'Every call follows the same backbone, so you always know where you are and what earns the next step.',
    steps: [
      { title: 'Open', body: 'Set the frame, agree the agenda and the decision this call is for.' },
      { title: 'Discover', body: 'Understand where they are, where they want to be and what it costs to stay.' },
      { title: 'Diagnose', body: 'Name the real gap — in their words, not yours.' },
      { title: 'Prescribe', body: 'Present only the part of your offer that closes that gap.' },
      { title: 'Commit', body: 'Ask for a clear decision and agree what happens next.' },
    ],
    relatedProgram: 'mentorship',
  },
  {
    id: 'doctor-frame',
    name: 'Doctor Frame',
    tagline: 'Diagnose before you prescribe',
    description: 'Trust is earned through better questions, not louder claims.',
    steps: [
      { title: 'Examine', body: 'Ask precise questions about the situation, not the solution.' },
      { title: 'Reflect', body: 'Play back what you heard so they feel understood.' },
      { title: 'Diagnose', body: 'State the root cause clearly and calmly.' },
      { title: 'Recommend', body: 'Offer the treatment — or say honestly if you are not the fit.' },
    ],
    relatedProgram: 'workshop',
  },
  {
    id: 'c3-certainty',
    name: 'C3 Certainty Reframe',
    tagline: 'When they say “I need to think about it.”',
    description: 'Hesitation is usually missing certainty, not missing interest. Find which certainty is missing and address it without pressure.',
    steps: [
      { title: 'Clarify', body: 'Find out what exactly they need to think about.' },
      { title: 'Confirm', body: 'Check certainty in the problem, the solution and themselves.' },
      { title: 'Commit', body: 'Resolve the real concern and invite a clear yes or no.' },
    ],
    relatedProgram: 'workshop',
  },
];
