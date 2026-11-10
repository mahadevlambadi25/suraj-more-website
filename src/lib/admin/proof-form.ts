import { z } from 'zod';
import { parseVideoUrl } from '../video';

// Admin forms for testimonials and case studies (PRD §8.2 case-study format, §11.2 content types).
// Publishing rule (PRD §2.1 / §8.2): nothing is published without the client's permission on file.

const text = (label: string, max: number) => z.string().trim().min(2, `${label} is required`).max(max, `${label} is too long`);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const videoUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .refine((v) => !v || parseVideoUrl(v) !== null, 'Video must be a YouTube or Vimeo link')
  .transform((v) => v || null);

const common = {
  verification: z.enum(['CLIENT_REPORTED', 'INDEPENDENTLY_VERIFIED'], { errorMap: () => ({ message: 'Choose how the result was verified' }) }),
  permissionOnFile: z.boolean(),
  status: z.enum(['DRAFT', 'PUBLISHED'], { errorMap: () => ({ message: 'Choose a status' }) }),
  sortOrder: z.coerce.number({ invalid_type_error: 'Order must be a number' }).int().min(0).max(9999).default(0),
};

const publishNeedsPermission = (v: { status: string; permissionOnFile: boolean }, ctx: z.RefinementCtx) => {
  if (v.status === 'PUBLISHED' && !v.permissionOnFile) {
    ctx.addIssue({ code: 'custom', path: ['permissionOnFile'], message: 'Confirm written permission is on file before publishing' });
  }
};

export const testimonialFormSchema = z
  .object({
    client: text('Client name', 120),
    role: text('Role', 120),
    niche: text('Business / niche', 120),
    quote: optionalText(2000),
    videoUrl,
    verifiedOutcome: optionalText(300),
    ...common,
  })
  .superRefine((v, ctx) => {
    if (!v.quote && !v.videoUrl) ctx.addIssue({ code: 'custom', path: ['quote'], message: 'Add the approved quote or a video link' });
    publishNeedsPermission(v, ctx);
  });

export const caseStudyFormSchema = z
  .object({
    client: text('Client name', 120),
    role: text('Role / company', 160),
    startingPoint: text('Starting point', 2000),
    intervention: text('Intervention', 2000),
    outcomeMetric: text('Outcome metric', 200),
    outcomeBaseline: text('Baseline', 200),
    outcomeResult: text('Result', 200),
    outcomePeriod: text('Period', 120),
    outcomeSource: text('Source', 300),
    caveat: text('Caveat', 500),
    videoUrl,
    ...common,
  })
  .superRefine(publishNeedsPermission);

export type TestimonialFormInput = z.infer<typeof testimonialFormSchema>;
export type CaseStudyFormInput = z.infer<typeof caseStudyFormSchema>;

export function issues(err: z.ZodError) {
  return err.issues.map((i) => `${i.path.join('.') || 'form'}: ${i.message}`).join(' · ');
}
