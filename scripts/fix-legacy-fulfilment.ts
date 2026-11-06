// One-off data correction (approved 6 Nov 2026): orders imported from the retired JSON store carried
// confirmationSentAt / zoomSentAt / crmSyncedAt timestamps, but that system only LOGGED those messages to the
// server console (no provider was configured). This resets them to "not sent" so /ops tells the truth.
//
//   npm run db:fix-legacy-fulfilment -- --dry-run
//   npm run db:fix-legacy-fulfilment
//
// Safety:
//  • Only touches orders that have an `imported_from_legacy_json` event AND no SENT IntegrationEvent (no proof of delivery).
//  • Never deletes orders, payments, registrations or events; the original fulfil_* events stay in the timeline.
//  • Sends NOTHING: it does not call any fulfilment or messaging code.
//  • Idempotent: a corrected order has null timestamps and is skipped on re-runs.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

const NOTE =
  'Not delivered: imported from the legacy JSON store, which only logged the confirmation, Zoom link and CRM sync to the server console ' +
  '(no email/WhatsApp/CRM provider was configured). Nothing was sent to the customer. Review before using "Retry confirmation / Zoom / CRM".';

async function main() {
  const candidates = await prisma.order.findMany({
    where: {
      events: { some: { type: 'imported_from_legacy_json' } },
      OR: [{ confirmationSentAt: { not: null } }, { zoomSentAt: { not: null } }, { crmSyncedAt: { not: null } }],
    },
  });
  console.log(`${candidates.length} imported order(s) with unverified delivery timestamps${dryRun ? ' (DRY RUN — nothing will be written)' : ''}`);

  for (const o of candidates) {
    const proof = await prisma.integrationEvent.count({ where: { relatedType: 'order', relatedId: o.id, status: 'SENT' } });
    if (proof > 0) {
      console.log(`- ${o.orderNumber}: skipped — ${proof} delivery record(s) prove a provider accepted messages`);
      continue;
    }
    const previous = {
      confirmationSentAt: o.confirmationSentAt?.toISOString() ?? null,
      zoomSentAt: o.zoomSentAt?.toISOString() ?? null,
      crmSyncedAt: o.crmSyncedAt?.toISOString() ?? null,
    };
    console.log(`- ${o.orderNumber} (${o.status}): reset ${JSON.stringify(previous)}`);
    if (dryRun) continue;

    await prisma.$transaction(async (tx) => {
      // Compare-and-set on the exact values we read, so a concurrent real delivery is never overwritten.
      const upd = await tx.order.updateMany({
        where: { id: o.id, confirmationSentAt: o.confirmationSentAt, zoomSentAt: o.zoomSentAt, crmSyncedAt: o.crmSyncedAt },
        data: { confirmationSentAt: null, zoomSentAt: null, crmSyncedAt: null, fulfilmentError: NOTE },
      });
      if (upd.count !== 1) throw new Error(`${o.orderNumber} changed while correcting — aborted, nothing written`);
      await tx.orderEvent.create({
        data: {
          orderId: o.id,
          type: 'legacy_fulfilment_corrected',
          detail: `Delivery marked NOT SENT. The legacy JSON system logged these messages without sending them. Previous values: confirmation ${previous.confirmationSentAt}, Zoom ${previous.zoomSentAt}, CRM ${previous.crmSyncedAt}. No message was sent by this correction.`,
        },
      });
      await tx.auditLog.create({
        data: {
          action: 'order.legacy_fulfilment_corrected',
          entityType: 'order',
          entityId: o.id,
          metadata: { orderNumber: o.orderNumber, previous, reason: 'Legacy JSON store logged messages without a delivery provider', messagesSent: 0 },
        },
      });
    });
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
