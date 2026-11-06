// Migrates records from the retired local JSON store (.data/db.json) into PostgreSQL.
//
//   npm run db:import-legacy -- [path/to/db.json] [--dry-run]
//
// • Idempotent: records already imported (matched on their unique keys) are skipped, so it is safe to re-run.
// • Run `npm run db:seed` first so legacy cohort slugs (e.g. "osw-sample-01") resolve.
// • Ends with a verification table: source count = imported + already-present, per collection.
// • Never deletes or modifies the source file. Back it up anyway (see /backups).
import { readFileSync } from 'node:fs';
import { Prisma, PrismaClient, type ApplicationStatus, type OrderStatus } from '@prisma/client';
import type { LegacyAttribution, LegacyDB } from './legacy/json-store';

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const file = args.find((a) => !a.startsWith('--')) ?? '.data/db.json';

const cols = (a?: LegacyAttribution) => ({
  utmSource: a?.utm_source,
  utmMedium: a?.utm_medium,
  utmCampaign: a?.utm_campaign,
  utmTerm: a?.utm_term,
  utmContent: a?.utm_content,
  referrer: a?.referrer,
  landingPage: a?.landingPage,
});
const json = (v: unknown) => (v == null ? Prisma.JsonNull : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue));
const at = (s?: string) => (s ? new Date(s) : undefined);

type Report = Record<string, { source: number; imported: number; present: number; failed: number }>;
const report: Report = {};
const tally = (k: string, n: number) => (report[k] ??= { source: n, imported: 0, present: 0, failed: 0 });

async function ensureLead(tx: Prisma.TransactionClient, p: { email: string; name: string; phone?: string; createdAt: string; attribution?: LegacyAttribution }, source: 'FREE_TRAINING' | 'WORKSHOP' | 'MENTORSHIP' | 'WAITLIST') {
  const email = p.email.toLowerCase();
  return (
    (await tx.lead.findUnique({ where: { email } })) ??
    tx.lead.create({ data: { email, name: p.name, phone: p.phone, source, createdAt: new Date(p.createdAt), ...cols(p.attribution) } })
  );
}

async function main() {
  const db = JSON.parse(readFileSync(file, 'utf8')) as LegacyDB;
  console.log(`Importing ${file}${dryRun ? ' (DRY RUN — nothing will be written)' : ''}`);

  // Legacy records carry their own ids. We remember them in AuditLog (entityType "legacy:<collection>")
  // so re-runs can detect already-imported records without adding legacy columns to the schema.
  const imported = new Set(
    (await prisma.auditLog.findMany({ where: { action: 'legacy.import' }, select: { entityType: true, entityId: true } })).map((r) => `${r.entityType}:${r.entityId}`),
  );

  const run = async (collection: keyof LegacyDB, items: { id: string }[], fn: (tx: Prisma.TransactionClient, item: never) => Promise<void>) => {
    const r = tally(collection, items.length);
    for (const item of items) {
      if (imported.has(`legacy:${collection}:${item.id}`)) {
        r.present++;
        continue;
      }
      if (dryRun) {
        r.imported++;
        continue;
      }
      try {
        await prisma.$transaction(async (tx) => {
          await fn(tx, item as never);
          await tx.auditLog.create({ data: { action: 'legacy.import', entityType: `legacy:${collection}`, entityId: item.id } });
        });
        r.imported++;
      } catch (err) {
        r.failed++;
        console.error(`  ✗ ${collection} ${item.id}: ${err instanceof Error ? err.message : err}`);
      }
    }
  };

  await run('leads', db.leads ?? [], async (tx, l: LegacyDB['leads'][number]) => {
    const lead = await ensureLead(tx, l, 'FREE_TRAINING');
    await tx.consentRecord.createMany({
      data: [
        { leadId: lead.id, type: 'MARKETING', granted: l.consents.marketing.granted, wording: l.consents.marketing.wording, source: l.consents.marketing.source, createdAt: new Date(l.consents.marketing.timestamp) },
        { leadId: lead.id, type: 'WHATSAPP', granted: l.consents.whatsapp.granted, wording: l.consents.whatsapp.wording, source: l.consents.whatsapp.source, createdAt: new Date(l.consents.whatsapp.timestamp) },
      ],
    });
    await tx.freeTrainingRegistration.create({
      data: { leadId: lead.id, audienceType: l.audienceType, city: l.city, businessUrl: l.businessUrl, whatsappConsent: l.consents.whatsapp.granted, attribution: json(l.attribution), createdAt: new Date(l.createdAt) },
    });
  });

  const appStatus: Record<string, ApplicationStatus> = { new: 'NEW', accepted: 'ACCEPTED', declined: 'REJECTED' };
  await run('applications', db.applications ?? [], async (tx, a: LegacyDB['applications'][number]) => {
    const lead = await ensureLead(tx, a, 'MENTORSHIP');
    await tx.consentRecord.create({ data: { leadId: lead.id, type: 'MARKETING', granted: a.consents.marketing.granted, wording: a.consents.marketing.wording, source: a.consents.marketing.source, createdAt: new Date(a.consents.marketing.timestamp) } });
    await tx.mentorshipApplication.create({
      data: {
        leadId: lead.id,
        name: a.name,
        email: a.email.toLowerCase(),
        phone: a.phone,
        link: a.link,
        offer: a.offer,
        salesChallenge: a.salesChallenge,
        desiredOutcome: a.desiredOutcome,
        timeline: a.timeline,
        timezone: a.timezone,
        revenueRange: a.revenueRange,
        status: appStatus[a.status] ?? 'NEW',
        decidedAt: at(a.decidedAt),
        attribution: json(a.attribution),
        createdAt: new Date(a.createdAt),
      },
    });
  });

  await run('waitlist', db.waitlist ?? [], async (tx, w: LegacyDB['waitlist'][number]) => {
    const lead = await ensureLead(tx, w, 'WAITLIST');
    const exists = await tx.waitlistEntry.findUnique({ where: { email_programId: { email: w.email.toLowerCase(), programId: w.programId } } });
    if (exists) return;
    await tx.waitlistEntry.create({ data: { leadId: lead.id, programId: w.programId, name: w.name, email: w.email.toLowerCase(), attribution: json(w.attribution), createdAt: new Date(w.createdAt) } });
  });

  const orderStatus: Record<string, OrderStatus> = {
    pending: 'PENDING',
    paid: 'PAID',
    failed: 'FAILED',
    dropped: 'DROPPED',
    refund_pending: 'REFUND_PENDING',
    refunded: 'REFUNDED',
    needs_review: 'NEEDS_REVIEW',
  };
  await run('orders', db.orders ?? [], async (tx, o: LegacyDB['orders'][number]) => {
    const cohort = await tx.workshopCohort.findUnique({ where: { slug: o.cohortId } });
    if (!cohort) throw new Error(`cohort "${o.cohortId}" not found — run npm run db:seed first`);
    if (await tx.order.findUnique({ where: { orderNumber: o.id } })) return;
    const lead = await ensureLead(tx, { ...o.customer, createdAt: o.createdAt, attribution: o.attribution }, 'WORKSHOP');
    const provider = !o.cfPaymentId || o.cfPaymentId.startsWith('mock_') ? 'MOCK' : 'CASHFREE';
    const status = orderStatus[o.status] ?? 'PENDING';
    const order = await tx.order.create({
      data: {
        orderNumber: o.id,
        cohortId: cohort.id,
        leadId: lead.id,
        customerName: o.customer.name,
        customerEmail: o.customer.email.toLowerCase(),
        customerPhone: o.customer.phone,
        vipAddon: o.vipAddon,
        lineItems: o.lineItems.map((l) => ({ label: l.label, amountPaise: Math.round(l.amountInr * 100) })),
        amountPaise: Math.round(o.amountInr * 100),
        currency: o.currency,
        status,
        provider,
        providerMode: provider === 'MOCK' ? 'mock' : 'sandbox',
        paymentSessionId: o.paymentSessionId,
        paidAt: at(o.paidAt),
        termsVersion: o.consents.terms.version,
        termsAcceptedAt: new Date(o.consents.terms.timestamp),
        attribution: json(o.attribution),
        purchaseEventClaimedAt: at(o.purchaseEventClaimedAt),
        // The legacy store marked messages "sent" after merely logging them, so its timestamps are NOT proof
        // of delivery. Imported orders start as not delivered (see scripts/fix-legacy-fulfilment.ts).
        confirmationSentAt: null,
        zoomSentAt: null,
        crmSyncedAt: null,
        fulfilmentError:
          o.fulfilment.confirmationSentAt || o.fulfilment.zoomSentAt || o.fulfilment.crmSyncedAt
            ? 'Not delivered: imported from the legacy JSON store, which only logged these messages. Review before resending.'
            : o.fulfilment.lastError,
        createdAt: new Date(o.createdAt),
      },
    });
    await tx.consentRecord.createMany({
      data: [
        { leadId: lead.id, type: 'TERMS', granted: true, wording: o.consents.terms.wording, version: o.consents.terms.version, source: o.consents.terms.source, createdAt: new Date(o.consents.terms.timestamp) },
        { leadId: lead.id, type: 'MARKETING', granted: o.consents.marketing.granted, wording: o.consents.marketing.wording, source: o.consents.marketing.source, createdAt: new Date(o.consents.marketing.timestamp) },
      ],
    });
    if (o.cfPaymentId && ['PAID', 'REFUND_PENDING', 'REFUNDED', 'NEEDS_REVIEW'].includes(status)) {
      await tx.payment.create({ data: { orderId: order.id, provider, providerPaymentId: o.cfPaymentId, status: 'SUCCESS', amountPaise: order.amountPaise, currency: o.currency, paidAt: at(o.paidAt) } });
    }
    if (['PAID', 'REFUND_PENDING', 'REFUNDED'].includes(status)) {
      await tx.workshopRegistration.create({
        data: { cohortId: cohort.id, orderId: order.id, leadId: lead.id, name: order.customerName, email: order.customerEmail, phone: order.customerPhone, vipAddon: order.vipAddon, status: status === 'REFUNDED' ? 'REFUNDED' : 'CONFIRMED' },
      });
      await tx.lead.update({ where: { id: lead.id }, data: { status: 'CUSTOMER' } });
    }
    await tx.orderEvent.createMany({ data: [...o.log.map((l) => ({ orderId: order.id, type: l.event, detail: l.detail, createdAt: new Date(l.at) })), { orderId: order.id, type: 'imported_from_legacy_json' }] });
  });

  await run('webhookEvents', db.webhookEvents ?? [], async (tx, e: LegacyDB['webhookEvents'][number]) => {
    const order = e.orderId ? await tx.order.findUnique({ where: { orderNumber: e.orderId } }) : null;
    await tx.webhookEvent.create({
      data: {
        provider: e.id.startsWith('mock-') ? 'MOCK' : 'CASHFREE',
        idempotencyKey: `legacy:${e.id}`,
        eventType: e.type,
        orderNumber: e.orderId,
        orderId: order?.id,
        signatureVerified: !e.id.startsWith('mock-'),
        // The legacy store kept no payloads: imported events are history only and cannot be retried.
        status: e.processedAt ? 'PROCESSED' : 'IGNORED',
        lastError: e.error ?? (e.processedAt ? null : 'Imported unprocessed legacy event (no payload stored)'),
        payload: { legacyImport: true },
        receivedAt: new Date(e.receivedAt),
        processedAt: at(e.processedAt),
      },
    });
  });

  await run('clicks', db.clicks ?? [], async (tx, c: LegacyDB['clicks'][number]) => {
    await tx.outboundClick.create({ data: { target: c.target, referrer: c.referrer, createdAt: new Date(c.createdAt) } });
  });

  console.log('\nVerification');
  console.table(report);
  const ok = Object.values(report).every((r) => r.failed === 0 && r.source === r.imported + r.present);
  console.log(ok ? '✓ All legacy records accounted for.' : '✗ Some records failed — see errors above. Re-run after fixing; imported records are skipped.');
  if (!ok) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
