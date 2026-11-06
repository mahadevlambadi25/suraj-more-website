import 'server-only';
import type { ConsentType, LeadSource } from '@prisma/client';
import type { Db } from './db';
import type { Attribution } from './validation';

export function attributionColumns(a: Attribution) {
  return {
    utmSource: a?.utm_source,
    utmMedium: a?.utm_medium,
    utmCampaign: a?.utm_campaign,
    utmTerm: a?.utm_term,
    utmContent: a?.utm_content,
    referrer: a?.referrer,
    landingPage: a?.landingPage,
  };
}

export function attributionJson(a: Attribution) {
  return a && Object.keys(a).length ? (JSON.parse(JSON.stringify(a)) as object) : undefined;
}

/**
 * One lead per email. First-touch source + UTM are kept; name/phone refresh on later submissions.
 * Uses Postgres ON CONFLICT via Prisma upsert.
 */
export function upsertLead(db: Db, person: { email: string; name: string; phone?: string | null }, source: LeadSource, attribution: Attribution) {
  return db.lead.upsert({
    where: { email: person.email.toLowerCase() },
    create: { email: person.email.toLowerCase(), name: person.name, phone: person.phone ?? null, source, ...attributionColumns(attribution) },
    update: { name: person.name, ...(person.phone ? { phone: person.phone } : {}) },
  });
}

/** Append-only consent ledger: wording, timestamp and source of every choice (brief §4). */
export function recordConsents(db: Db, leadId: string, source: string, items: { type: ConsentType; granted: boolean; wording: string; version?: string }[]) {
  return db.consentRecord.createMany({ data: items.map((i) => ({ leadId, source, ...i })) });
}
