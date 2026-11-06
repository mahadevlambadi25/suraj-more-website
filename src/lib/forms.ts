import 'server-only';
import { prisma } from './db';
import { env } from './env';
import { alertOps, crmSync, sendMessage } from './integrations';
import { attributionJson, recordConsents, upsertLead } from './leads';
import { safeError } from './security';
import {
  COLLECT_REVENUE_RANGE,
  CONSENT_WORDING,
  type Attribution,
  type FreeTrainingInput,
  type MentorshipInput,
  type WaitlistInput,
} from './validation';

// Form business logic, independent of HTTP. Follow-ups (email/CRM) never block the user — their outcome is
// recorded honestly in IntegrationEvent and failures alert ops.

function settle(label: string, ref: Record<string, unknown>, promises: Promise<unknown>[]) {
  return Promise.allSettled(promises).then((results) =>
    Promise.all(results.map((r) => (r.status === 'rejected' ? alertOps(`${label} follow-up failed`, { ...ref, error: safeError(r.reason) }) : undefined))),
  );
}

export async function submitFreeTraining(data: FreeTrainingInput, attribution: Attribution) {
  const { lead, registration } = await prisma.$transaction(async (tx) => {
    const lead = await upsertLead(tx, { email: data.email, name: data.name, phone: data.phone }, 'FREE_TRAINING', attribution);
    await recordConsents(tx, lead.id, 'free-training-form', [
      { type: 'MARKETING', granted: data.marketingConsent, wording: CONSENT_WORDING.marketing },
      { type: 'WHATSAPP', granted: data.whatsappConsent, wording: CONSENT_WORDING.whatsapp },
    ]);
    const registration = await tx.freeTrainingRegistration.create({
      data: {
        leadId: lead.id,
        audienceType: data.audienceType,
        city: data.city || null,
        businessUrl: data.businessUrl || null,
        whatsappConsent: data.whatsappConsent,
        attribution: attributionJson(attribution),
      },
    });
    return { lead, registration };
  });

  const watchUrl = `${env.siteUrl}/free-training/watch`;
  const related = { relatedType: 'free_training', relatedId: registration.id };
  await settle('Free training', { registrationId: registration.id }, [
    sendMessage({ kind: 'transactional', channel: 'email', template: 'free_training_access', to: lead.email, data: { name: lead.name, watchUrl }, ...related }),
    ...(data.whatsappConsent
      ? [sendMessage({ kind: 'transactional', channel: 'whatsapp', template: 'free_training_access', to: data.phone, data: { name: lead.name, watchUrl }, ...related })]
      : []),
    crmSync({
      type: 'lead',
      email: lead.email,
      name: lead.name,
      phone: data.phone,
      tags: ['free-training', `audience:${data.audienceType}`],
      fields: { leadId: lead.id, city: data.city, businessUrl: data.businessUrl, attribution },
      marketingConsent: data.marketingConsent,
      ...related,
    }),
  ]);
  return { leadId: lead.id, registrationId: registration.id };
}

export async function submitMentorshipApplication(data: MentorshipInput, attribution: Attribution) {
  const app = await prisma.$transaction(async (tx) => {
    const lead = await upsertLead(tx, { email: data.email, name: data.name, phone: data.phone }, 'MENTORSHIP', attribution);
    await recordConsents(tx, lead.id, 'mentorship-application', [{ type: 'MARKETING', granted: data.marketingConsent, wording: CONSENT_WORDING.marketing }]);
    return tx.mentorshipApplication.create({
      data: {
        leadId: lead.id,
        name: data.name,
        email: data.email.toLowerCase(),
        phone: data.phone,
        link: data.link,
        offer: data.offer,
        salesChallenge: data.salesChallenge,
        desiredOutcome: data.desiredOutcome,
        timeline: data.timeline,
        timezone: data.timezone,
        revenueRange: COLLECT_REVENUE_RANGE ? data.revenueRange : null,
        attribution: attributionJson(attribution),
      },
    });
  });

  const related = { relatedType: 'application', relatedId: app.id };
  await settle('Mentorship application', { applicationId: app.id }, [
    sendMessage({ kind: 'transactional', channel: 'email', template: 'mentorship_application_received', to: app.email, data: { name: app.name, applicationId: app.id }, ...related }),
    // Free-text answers go to the CRM only — never to ad platforms (brief §5).
    crmSync({
      type: 'mentorship_application',
      email: app.email,
      name: app.name,
      phone: app.phone,
      tags: ['mentorship-applicant', `timeline:${app.timeline}`],
      fields: { applicationId: app.id, link: app.link, offer: app.offer, salesChallenge: app.salesChallenge, desiredOutcome: app.desiredOutcome, timezone: app.timezone },
      marketingConsent: data.marketingConsent,
      ...related,
    }),
    alertOps('New mentorship application', { applicationId: app.id, timeline: app.timeline }),
  ]);
  return { applicationId: app.id };
}

/** Returns { created: false } when the email is already on this waitlist (idempotent). */
export async function joinWaitlist(data: WaitlistInput, attribution: Attribution) {
  const existing = await prisma.waitlistEntry.findUnique({ where: { email_programId: { email: data.email.toLowerCase(), programId: data.programId } } });
  if (existing) return { created: false, entryId: existing.id };

  const entry = await prisma.$transaction(async (tx) => {
    const lead = await upsertLead(tx, { email: data.email, name: data.name }, 'WAITLIST', attribution);
    await recordConsents(tx, lead.id, `waitlist-${data.programId}`, [{ type: 'MARKETING', granted: data.marketingConsent, wording: CONSENT_WORDING.marketing }]);
    return tx.waitlistEntry.create({
      data: { leadId: lead.id, programId: data.programId, name: data.name, email: data.email.toLowerCase(), attribution: attributionJson(attribution) },
    });
  });

  const related = { relatedType: 'waitlist', relatedId: entry.id };
  await settle('Waitlist', { entryId: entry.id }, [
    sendMessage({ kind: 'transactional', channel: 'email', template: 'waitlist_confirmation', to: entry.email, data: { name: entry.name, programId: entry.programId }, ...related }),
    crmSync({ type: 'waitlist', email: entry.email, name: entry.name, tags: [`waitlist:${entry.programId}`], marketingConsent: data.marketingConsent, ...related }),
  ]);
  return { created: true, entryId: entry.id };
}
