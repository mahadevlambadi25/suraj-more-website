import type { LegalDoc } from '@/lib/types';

// ⚠ DRAFTS ONLY. Must be reviewed by a lawyer (DPDP Act 2023, GST/invoicing) before launch — brief §8 issue #9.
// Bracketed placeholders are filled once the legal entity and address are verified.
const ENTITY = '[Legal entity name — pending verification]';

export const legalDocs: LegalDoc[] = [
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    version: '0.1-draft',
    effectiveDate: '2026-11-06',
    reviewed: false,
    sections: [
      {
        heading: 'Who we are',
        body: [`This website is operated by ${ENTITY} (“we”, “us”). This notice explains how we collect and use personal data when you use this website and our programs.`],
      },
      {
        heading: 'What we collect',
        body: [
          'Details you submit in forms: name, email, phone/WhatsApp number and the answers you provide.',
          'Order details for workshop purchases. Card and bank details are processed by our payment provider (Cashfree) and are not stored by us.',
          'Technical and attribution data such as campaign (UTM) parameters, referrer and — only with your consent — analytics cookies.',
        ],
      },
      {
        heading: 'Why we use it',
        body: [
          'To deliver what you asked for: access to training, workshop registration, Zoom links, reminders and support.',
          'To review mentorship applications.',
          'To send marketing updates — only if you opted in separately. You can opt out at any time.',
        ],
      },
      {
        heading: 'Your consent and choices',
        body: [
          'We record the wording, time and source of any consent you give. Transactional messages (e.g. your Zoom link) are kept separate from promotional messages on WhatsApp, SMS and email.',
          'You may request access to, correction of, or deletion of your data by writing to the contact address on our Contact page.',
        ],
      },
      {
        heading: 'Sharing',
        body: ['We share data only with service providers needed to run the service (payments, email/WhatsApp delivery, CRM, video hosting, analytics) under appropriate agreements. We do not sell personal data.'],
      },
      {
        heading: 'Retention and security',
        body: ['We keep data only as long as needed for the purposes above or as required by law, and protect it with reasonable technical and organisational measures.'],
      },
    ],
  },
  {
    slug: 'terms-and-conditions',
    title: 'Terms and Conditions',
    version: '0.1-draft',
    effectiveDate: '2026-11-06',
    reviewed: false,
    sections: [
      { heading: 'About these terms', body: [`These terms govern your use of this website and the programs offered by ${ENTITY}.`] },
      {
        heading: 'Programs and access',
        body: [
          'Workshop access is personal and non-transferable. Zoom links are shared only after successful payment and must not be redistributed.',
          'Level Zero is hosted on Whop and is also subject to Whop’s terms.',
          'Mentorship is offered by application only; acceptance is at our discretion.',
        ],
      },
      {
        heading: 'No guarantee of results',
        body: ['Our programs teach skills and frameworks. Outcomes depend on many factors outside our control. We do not guarantee any income, revenue, conversion rate or other result.'],
      },
      { heading: 'Intellectual property', body: ['All course materials, frameworks, recordings and workbooks are owned by us and licensed to you for personal use only.'] },
      { heading: 'Payments', body: ['Prices are shown in INR and are inclusive/exclusive of applicable taxes as stated at checkout. [GST wording — pending confirmation.]'] },
      { heading: 'Governing law', body: ['These terms are governed by the laws of India. [Jurisdiction — pending legal review.]'] },
    ],
  },
  {
    slug: 'refund-policy',
    title: 'Refund and Cancellation Policy',
    version: '0.1-draft',
    effectiveDate: '2026-11-06',
    reviewed: false,
    sections: [
      { heading: 'Workshop', body: ['[Refund window and conditions for the One Skill Workshop — pending confirmation from Suraj.]', 'If a workshop is cancelled or rescheduled by us, you will be offered a seat in the next cohort or a full refund.'] },
      { heading: 'Recording + VIP Pack', body: ['[Refund conditions for the add-on — pending confirmation.]'] },
      { heading: 'Mentorship', body: ['Refund terms for mentorship are set out in your individual agreement.'] },
      { heading: 'How to request a refund', body: ['Contact us using the details on the Contact page with your order ID. Approved refunds are processed to the original payment method via our payment provider; bank timelines apply.'] },
    ],
  },
];
