// Shared validation — the same schemas run in the browser (inline errors) and on the server (source of truth).
import { z } from 'zod';

const name = z.string().trim().min(2, 'Please enter your full name').max(80, 'Name is too long');
const email = z.string().trim().toLowerCase().email('Please enter a valid email address').max(120);
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s-]{8,16}$/, 'Please enter a valid mobile number, e.g. +91 98765 43210');
const optionalUrl = z
  .string()
  .trim()
  .max(200)
  .optional()
  .refine((v) => !v || /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v) || /^@[\w.]{2,}$/.test(v), 'Please enter a valid link or @handle');

export const attributionSchema = z
  .object({
    utm_source: z.string().max(100).optional(),
    utm_medium: z.string().max(100).optional(),
    utm_campaign: z.string().max(150).optional(),
    utm_term: z.string().max(150).optional(),
    utm_content: z.string().max(150).optional(),
    referrer: z.string().max(300).optional(),
    landingPage: z.string().max(300).optional(),
  })
  .partial()
  .optional();

/** Anti-spam fields every public form sends. */
export const antiSpamSchema = z.object({
  website_hp: z.string().max(0).optional(), // honeypot: must stay empty
  startedAt: z.number().optional(),
});

export const AUDIENCE_TYPES = [
  { value: 'coach', label: 'Coach (health, fitness, mindset, etc.)' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'agency-owner', label: 'Agency owner' },
  { value: 'sales-professional', label: 'Sales professional / closer' },
  { value: 'other', label: 'Something else' },
] as const;

export const freeTrainingSchema = z.object({
  name,
  email,
  phone,
  audienceType: z.enum(['coach', 'consultant', 'agency-owner', 'sales-professional', 'other'], {
    errorMap: () => ({ message: 'Please choose what best describes you' }),
  }),
  city: z.string().trim().max(80).optional(),
  businessUrl: optionalUrl,
  whatsappConsent: z.boolean().default(false),
  marketingConsent: z.boolean().default(false),
});

export const workshopOrderSchema = z.object({
  name,
  email,
  phone,
  cohortId: z.string().min(1),
  vipAddon: z.boolean().default(false),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: 'Please accept the terms to continue' }) }),
  marketingConsent: z.boolean().default(false),
});

export const TIMELINES = [
  { value: 'now', label: 'Ready to start in the next 2 weeks' },
  { value: '1-month', label: 'Within a month' },
  { value: '1-3-months', label: 'In 1–3 months' },
  { value: 'exploring', label: 'Just exploring for now' },
] as const;

export const REVENUE_RANGES = ['Under ₹1L / month', '₹1L–5L / month', '₹5L–20L / month', 'Over ₹20L / month', 'Prefer not to say'] as const;

/** Brief §8 issue #6: revenue range is only collected if it is genuinely used for qualification. */
export const COLLECT_REVENUE_RANGE = false;

export const mentorshipStepSchemas = [
  z.object({ name, email, phone, link: z.string().trim().min(3, 'Please share your website or a social profile').max(200) }),
  z.object({
    offer: z.string().trim().min(15, 'Please describe your offer in a sentence or two').max(1000),
    salesChallenge: z.string().trim().min(15, 'Please tell us a little more about the challenge').max(1500),
    revenueRange: z.string().max(40).optional(),
  }),
  z.object({
    desiredOutcome: z.string().trim().min(15, 'Please describe the outcome you want').max(1500),
    timeline: z.enum(['now', '1-month', '1-3-months', 'exploring'], { errorMap: () => ({ message: 'Please choose a timeline' }) }),
    timezone: z.string().min(2).max(60),
    marketingConsent: z.boolean().default(false),
  }),
] as const;

export const mentorshipSchema = mentorshipStepSchemas[0].merge(mentorshipStepSchemas[1]).merge(mentorshipStepSchemas[2]);

export const waitlistSchema = z.object({
  name,
  email,
  programId: z.enum(['workshop', 'inner-circle']),
  marketingConsent: z.boolean().default(false),
});

export type FreeTrainingInput = z.infer<typeof freeTrainingSchema>;
export type WorkshopOrderInput = z.infer<typeof workshopOrderSchema>;
export type MentorshipInput = z.infer<typeof mentorshipSchema>;
export type WaitlistInput = z.infer<typeof waitlistSchema>;
export type Attribution = z.infer<typeof attributionSchema>;

/** Consent wording is stored verbatim with each record (brief §4: wording, timestamp, source). */
export const CONSENT_WORDING = {
  marketing: 'Send me occasional emails about new trainings and programs. I can unsubscribe anytime.',
  whatsapp: 'Send my access details and reminders on WhatsApp too.',
  terms: 'I agree to the Terms and Refund Policy. My details will be used to deliver this workshop.',
} as const;

export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
