import 'server-only';
import crypto from 'crypto';
import type { OrderStatus, PaymentProvider, PaymentStatus, Prisma, RefundStatus } from '@prisma/client';
import { CashfreeApiError, cfCreateOrder, cfCreateRefund, cfGetPayments, cfGetRefund, type CashfreeWebhook } from './cashfree';
import { findCohortRow, isCohortPurchasable, seatsTaken, sessionsSchema } from './cohorts';
import { isUniqueViolation, prisma, type Tx } from './db';
import { env } from './env';
import { formatDate, formatTime } from './format';
import { alertOps, crmSync, sendMessage } from './integrations';
import { attributionJson, recordConsents, upsertLead } from './leads';
import { formatPaise, paiseToRupees, providerAmountToPaise } from './money';
import { safeError } from './security';
import { CONSENT_WORDING, type Attribution, type WorkshopOrderInput } from './validation';

export const TERMS_VERSION = '0.1-draft';

export class OrderError extends Error {
  constructor(
    public code: 'COHORT_CLOSED' | 'COHORT_FULL' | 'PAYMENT_PROVIDER' | 'NOT_FOUND' | 'REFUND_NOT_ALLOWED',
    message: string,
  ) {
    super(message);
  }
}

const RETRYABLE_UNPAID: OrderStatus[] = ['PENDING', 'FAILED', 'DROPPED'];

function newOrderNumber() {
  // Cashfree order_id: 3–45 chars of [A-Za-z0-9_-]
  return `smw_${crypto.randomBytes(9).toString('base64url')}`;
}

function logEvent(db: Tx | typeof prisma, orderId: string, type: string, detail?: string) {
  return db.orderEvent.create({ data: { orderId, type, detail: detail?.slice(0, 500) } });
}

function currentProvider(): { provider: PaymentProvider; mode: string } {
  const mode = env.cashfree.mode;
  return { provider: mode === 'mock' ? 'MOCK' : 'CASHFREE', mode };
}

// ───────────────────────────── 1. Create pending order ─────────────────────────────

export async function createWorkshopOrder(input: WorkshopOrderInput, attribution: Attribution) {
  const cohort = await findCohortRow(input.cohortId);
  if (!cohort || !isCohortPurchasable(cohort)) throw new OrderError('COHORT_CLOSED', 'This cohort is no longer open for registration.');
  if (cohort.seatLimit != null && (await seatsTaken(cohort.id)) >= cohort.seatLimit) {
    throw new OrderError('COHORT_FULL', 'This cohort is full. Join the waitlist to hear about the next one.');
  }

  // Amount is ALWAYS computed on the server, in paise, from the database — never trusted from the browser.
  const lineItems = [{ label: cohort.title, amountPaise: cohort.pricePaise }];
  const vip = input.vipAddon && cohort.vipAddonActive;
  if (vip) lineItems.push({ label: cohort.vipAddonTitle, amountPaise: cohort.vipAddonPricePaise });
  const amountPaise = lineItems.reduce((s, l) => s + l.amountPaise, 0);
  const { provider, mode } = currentProvider();

  const order = await prisma.$transaction(async (tx) => {
    const lead = await upsertLead(tx, { email: input.email, name: input.name, phone: input.phone }, 'WORKSHOP', attribution);
    await recordConsents(tx, lead.id, 'workshop-checkout', [
      { type: 'TERMS', granted: true, wording: CONSENT_WORDING.terms, version: TERMS_VERSION },
      { type: 'MARKETING', granted: input.marketingConsent, wording: CONSENT_WORDING.marketing },
    ]);
    const o = await tx.order.create({
      data: {
        orderNumber: newOrderNumber(),
        cohortId: cohort.id,
        leadId: lead.id,
        customerName: input.name,
        customerEmail: input.email.toLowerCase(),
        customerPhone: input.phone,
        vipAddon: vip,
        lineItems,
        amountPaise,
        provider,
        providerMode: mode,
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: new Date(),
        attribution: attributionJson(attribution),
      },
    });
    await logEvent(tx, o.id, 'created', `amount ${amountPaise} paise, mode ${mode}`);
    return o;
  });

  if (mode === 'mock') return { orderId: order.orderNumber, mode, paymentSessionId: null };

  try {
    const cf = await cfCreateOrder({
      orderNumber: order.orderNumber,
      amountPaise,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      note: lineItems.map((l) => l.label).join(' + '),
      tags: { cohort: cohort.slug, vip_addon: String(vip) },
    });
    await prisma.order.update({ where: { id: order.id }, data: { paymentSessionId: cf.paymentSessionId, providerOrderId: cf.providerOrderId } });
    await logEvent(prisma, order.id, 'cashfree_session_created', cf.providerOrderId ?? undefined);
    return { orderId: order.orderNumber, mode, paymentSessionId: cf.paymentSessionId };
  } catch (err) {
    await prisma.order.update({ where: { id: order.id }, data: { status: 'FAILED' } });
    await logEvent(prisma, order.id, 'cashfree_create_failed', safeError(err));
    await alertOps('Cashfree order creation failed', { orderNumber: order.orderNumber, error: safeError(err) });
    throw new OrderError('PAYMENT_PROVIDER', 'We could not start the payment. Please try again in a moment.');
  }
}

// ───────────────────────────── 2. Payment state transitions ─────────────────────────────

type PaidOutcome = 'paid' | 'already' | 'mismatch' | 'not_found';

/**
 * Marks an order paid EXACTLY once — atomic compare-and-set (UPDATE … WHERE status IN (unpaid states)).
 * Concurrent duplicate webhooks serialise on the row lock; only one transaction sees count = 1.
 */
export async function markPaid(
  orderNumber: string,
  payment: { provider: PaymentProvider; providerPaymentId: string; amountPaise: number; currency: string; method?: string },
): Promise<PaidOutcome> {
  const outcome = await prisma.$transaction(async (tx): Promise<PaidOutcome> => {
    const order = await tx.order.findUnique({ where: { orderNumber } });
    if (!order) return 'not_found';

    await tx.payment.upsert({
      where: { provider_providerPaymentId: { provider: payment.provider, providerPaymentId: payment.providerPaymentId } },
      create: {
        orderId: order.id,
        provider: payment.provider,
        providerPaymentId: payment.providerPaymentId,
        status: 'SUCCESS',
        amountPaise: payment.amountPaise,
        currency: payment.currency,
        method: payment.method,
        paidAt: new Date(),
      },
      update: { status: 'SUCCESS' },
    });

    if (payment.amountPaise !== order.amountPaise || payment.currency !== order.currency) {
      const upd = await tx.order.updateMany({ where: { id: order.id, status: { in: RETRYABLE_UNPAID } }, data: { status: 'NEEDS_REVIEW' } });
      await logEvent(tx, order.id, 'amount_mismatch', `expected ${order.amountPaise} ${order.currency}, got ${payment.amountPaise} ${payment.currency}`);
      return upd.count ? 'mismatch' : 'already';
    }

    const upd = await tx.order.updateMany({ where: { id: order.id, status: { in: RETRYABLE_UNPAID } }, data: { status: 'PAID', paidAt: new Date() } });
    if (upd.count === 0) {
      await logEvent(tx, order.id, 'duplicate_success_ignored', payment.providerPaymentId);
      return 'already';
    }
    await tx.workshopRegistration.create({
      data: {
        cohortId: order.cohortId,
        orderId: order.id,
        leadId: order.leadId,
        name: order.customerName,
        email: order.customerEmail,
        phone: order.customerPhone,
        vipAddon: order.vipAddon,
      },
    });
    await tx.lead.update({ where: { id: order.leadId }, data: { status: 'CUSTOMER' } });
    await logEvent(tx, order.id, 'paid', payment.providerPaymentId);
    return 'paid';
  });

  if (outcome === 'mismatch') await alertOps('Payment amount mismatch — order needs review', { orderNumber, ...payment });
  return outcome;
}

async function recordUnsuccessfulPayment(
  orderNumber: string,
  status: Extract<OrderStatus, 'FAILED' | 'DROPPED'>,
  payment?: { provider: PaymentProvider; providerPaymentId: string; status: PaymentStatus; amountPaise: number; currency: string; message?: string },
) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { orderNumber } });
    if (!order) throw new OrderError('NOT_FOUND', `Order ${orderNumber} not found`);
    if (payment) {
      await tx.payment.upsert({
        where: { provider_providerPaymentId: { provider: payment.provider, providerPaymentId: payment.providerPaymentId } },
        create: { orderId: order.id, ...payment },
        // Never overwrite a SUCCESS payment with a late failure.
        update: {},
      });
    }
    // Late/out-of-order failures never downgrade a paid or refunded order.
    const upd = await tx.order.updateMany({ where: { id: order.id, status: { in: RETRYABLE_UNPAID } }, data: { status } });
    await logEvent(tx, order.id, upd.count ? `payment_${status.toLowerCase()}` : `late_${status.toLowerCase()}_ignored`, payment?.message);
  });
}

// ───────────────────────────── 3. Refunds ─────────────────────────────

const TERMINAL_REFUND: RefundStatus[] = ['SUCCESS', 'FAILED', 'CANCELLED'];

/**
 * Applies a provider refund status. Idempotent and order-safe:
 *  • the same status twice is a no-op (only fills in the provider refund id)
 *  • a terminal refund (SUCCESS / FAILED / CANCELLED) never moves back to PENDING/ONHOLD
 *  • a SUCCESS refund never changes again
 */
export async function applyRefundStatus(refundNumber: string, status: RefundStatus, details: { providerRefundId?: string; failureReason?: string } = {}) {
  await prisma.$transaction(async (tx) => {
    const refund = await tx.refund.findUnique({ where: { refundNumber } });
    if (!refund) throw new OrderError('NOT_FOUND', `Refund ${refundNumber} not found`);
    if (refund.status === status) {
      if (details.providerRefundId && !refund.providerRefundId) {
        await tx.refund.update({ where: { id: refund.id }, data: { providerRefundId: details.providerRefundId } });
      }
      return;
    }
    if (refund.status === 'SUCCESS' || (TERMINAL_REFUND.includes(refund.status) && !TERMINAL_REFUND.includes(status))) {
      await logEvent(tx, refund.orderId, 'refund_status_regression_ignored', `${refund.status} → ${status}`);
      return;
    }
    await tx.refund.update({
      where: { id: refund.id },
      data: {
        status,
        providerRefundId: details.providerRefundId ?? refund.providerRefundId,
        failureReason: details.failureReason ?? (status === 'SUCCESS' ? null : refund.failureReason),
        processedAt: status === 'SUCCESS' || status === 'FAILED' || status === 'CANCELLED' ? new Date() : refund.processedAt,
      },
    });
    if (status === 'SUCCESS') {
      await tx.order.update({ where: { id: refund.orderId }, data: { status: 'REFUNDED' } });
      await tx.workshopRegistration.updateMany({ where: { orderId: refund.orderId }, data: { status: 'REFUNDED' } });
    } else if (status === 'FAILED' || status === 'CANCELLED') {
      await tx.order.updateMany({ where: { id: refund.orderId, status: 'REFUND_PENDING' }, data: { status: 'PAID' } });
    } else {
      await tx.order.updateMany({ where: { id: refund.orderId, status: { in: ['PAID', 'REFUND_PENDING'] } }, data: { status: 'REFUND_PENDING' } });
    }
    await logEvent(tx, refund.orderId, `refund_${status.toLowerCase()}`, refundNumber);
  });
}

/**
 * Starts a full refund. The atomic PAID → REFUND_PENDING transition guarantees at most one active refund
 * per order, so double-clicks or concurrent admins cannot create duplicate refunds.
 */
export async function requestRefund(orderId: string, opts: { adminId?: string; reason: string }) {
  const refund = await prisma.$transaction(async (tx) => {
    const upd = await tx.order.updateMany({ where: { id: orderId, status: 'PAID' }, data: { status: 'REFUND_PENDING' } });
    if (upd.count === 0) throw new OrderError('REFUND_NOT_ALLOWED', 'Only paid orders without an active refund can be refunded.');
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    const r = await tx.refund.create({
      data: { refundNumber: `rf_${crypto.randomBytes(8).toString('hex')}`, orderId, amountPaise: order.amountPaise, reason: opts.reason, requestedById: opts.adminId },
    });
    await logEvent(tx, orderId, 'refund_requested', `${r.refundNumber}: ${opts.reason}`);
    return { ...r, orderNumber: order.orderNumber, provider: order.provider };
  });

  if (refund.provider === 'MOCK') {
    await applyRefundStatus(refund.refundNumber, 'SUCCESS', { providerRefundId: `mock_rf_${Date.now()}` });
    return refund;
  }

  try {
    const res = await cfCreateRefund(refund.orderNumber, refund.amountPaise, refund.refundNumber, opts.reason);
    await applyRefundStatus(refund.refundNumber, res.refund_status ?? 'PENDING', { providerRefundId: res.cf_refund_id != null ? String(res.cf_refund_id) : undefined });
  } catch (err) {
    if (err instanceof CashfreeApiError && err.definitive) {
      // Cashfree definitively rejected it → no refund exists; release the order.
      await applyRefundStatus(refund.refundNumber, 'FAILED', { failureReason: safeError(err) });
    } else {
      // Outcome unknown (timeout/5xx): keep PENDING so nobody issues a second refund; "Sync" checks Cashfree.
      await prisma.refund.update({ where: { id: refund.id }, data: { failureReason: `Provider response unknown — use "Sync status". ${safeError(err)}` } });
    }
    await alertOps('Refund request problem', { refundNumber: refund.refundNumber, error: safeError(err) });
    throw err;
  }
  return refund;
}

/** Pulls the current refund status from Cashfree (for unknown/pending outcomes). */
export async function syncRefund(refundId: string) {
  const refund = await prisma.refund.findUniqueOrThrow({ where: { id: refundId }, include: { order: true } });
  if (refund.order.provider === 'MOCK') return refund.status;
  const res = await cfGetRefund(refund.order.orderNumber, refund.refundNumber);
  await applyRefundStatus(refund.refundNumber, res.refund_status, { providerRefundId: res.cf_refund_id != null ? String(res.cf_refund_id) : undefined, failureReason: res.status_description });
  return res.refund_status;
}

// ───────────────────────────── 4. Webhook processing (idempotent) ─────────────────────────────

/**
 * Records the event (unique idempotency key) and processes it.
 * A PROCESSED/IGNORED key is never processed again; a FAILED/RECEIVED one is retried (Cashfree retry or admin).
 */
export async function handleCashfreeEvent(event: CashfreeWebhook, idempotencyKey: string, opts: { provider: PaymentProvider; signatureVerified: boolean }) {
  const orderNumber = event.data.order?.order_id ?? event.data.refund?.order_id ?? null;
  let row = await prisma.webhookEvent.findUnique({ where: { idempotencyKey } });
  if (row && (row.status === 'PROCESSED' || row.status === 'IGNORED')) return { duplicate: true, status: row.status };
  if (row) return { duplicate: false, status: await processWebhookEvent(row.id) }; // Cashfree retry of a failed event
  try {
    const order = orderNumber ? await prisma.order.findUnique({ where: { orderNumber }, select: { id: true } }) : null;
    row = await prisma.webhookEvent.create({
      data: {
        provider: opts.provider,
        idempotencyKey,
        eventType: event.type,
        orderNumber,
        orderId: order?.id,
        signatureVerified: opts.signatureVerified,
        payload: event as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    row = await prisma.webhookEvent.findUniqueOrThrow({ where: { idempotencyKey } });
    if (row.status === 'PROCESSED' || row.status === 'IGNORED') return { duplicate: true, status: row.status };
  }
  const status = await processWebhookEvent(row.id);
  return { duplicate: false, status };
}

/** Processes (or re-processes) a stored webhook event. Safe to call repeatedly — every transition is idempotent. */
export async function processWebhookEvent(id: string) {
  const row = await prisma.webhookEvent.update({ where: { id }, data: { attempts: { increment: 1 } } });
  if (row.status === 'PROCESSED' || row.status === 'IGNORED') return row.status;
  if (!row.signatureVerified && row.provider !== 'MOCK') throw new Error('Refusing to process an unverified webhook');

  const event = row.payload as unknown as CashfreeWebhook;
  try {
    const result = await dispatch(event, row.provider);
    await prisma.webhookEvent.update({ where: { id }, data: { status: result, processedAt: new Date(), lastError: null } });
    return result;
  } catch (err) {
    await prisma.webhookEvent.update({ where: { id }, data: { status: 'FAILED', lastError: safeError(err) } });
    await alertOps('Cashfree webhook processing failed', { webhookEventId: id, type: event.type, orderNumber: row.orderNumber, error: safeError(err) });
    throw err;
  }
}

async function dispatch(event: CashfreeWebhook, provider: PaymentProvider): Promise<'PROCESSED' | 'IGNORED'> {
  const p = event.data.payment;
  const orderNumber = event.data.order?.order_id;
  switch (event.type) {
    case 'PAYMENT_SUCCESS_WEBHOOK': {
      if (!orderNumber || !p || p.payment_status !== 'SUCCESS') throw new Error('Success webhook without a SUCCESS payment');
      const providerPaymentId = String(p.cf_payment_id);
      if (provider === 'CASHFREE' && env.cashfree.verifyWithApi) {
        // Defence in depth: confirm with Cashfree's API that this payment really succeeded.
        const payments = await cfGetPayments(orderNumber);
        const match = payments.find((x) => String(x.cf_payment_id) === providerPaymentId && x.payment_status === 'SUCCESS');
        if (!match) throw new Error(`Cashfree API does not confirm payment ${providerPaymentId} as SUCCESS`);
      }
      const outcome = await markPaid(orderNumber, {
        provider,
        providerPaymentId,
        amountPaise: providerAmountToPaise(p.payment_amount),
        currency: p.payment_currency ?? event.data.order?.order_currency ?? 'INR',
        method: p.payment_group,
      });
      if (outcome === 'not_found') throw new OrderError('NOT_FOUND', `Order ${orderNumber} not found`);
      if (outcome === 'paid') {
        const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber }, select: { id: true } });
        await fulfilOrder(order.id); // records its own failures; never un-pays an order
      }
      return 'PROCESSED';
    }
    case 'PAYMENT_FAILED_WEBHOOK':
    case 'PAYMENT_USER_DROPPED_WEBHOOK': {
      if (!orderNumber) throw new Error('Webhook has no order_id');
      const failed = event.type === 'PAYMENT_FAILED_WEBHOOK';
      await recordUnsuccessfulPayment(
        orderNumber,
        failed ? 'FAILED' : 'DROPPED',
        p
          ? {
              provider,
              providerPaymentId: String(p.cf_payment_id),
              status: failed ? 'FAILED' : 'USER_DROPPED',
              amountPaise: providerAmountToPaise(p.payment_amount),
              currency: p.payment_currency ?? 'INR',
              message: p.payment_message,
            }
          : undefined,
      );
      return 'PROCESSED';
    }
    case 'REFUND_STATUS_WEBHOOK': {
      const r = event.data.refund;
      if (!r?.refund_id) throw new Error('Refund webhook without refund_id');
      const existing = await prisma.refund.findUnique({ where: { refundNumber: r.refund_id } });
      if (!existing) {
        // Refund created outside the dashboard (e.g. Cashfree portal) — record it so history stays complete.
        const order = await prisma.order.findUnique({ where: { orderNumber: r.order_id } });
        if (!order) throw new OrderError('NOT_FOUND', `Order ${r.order_id} not found`);
        await prisma.refund.create({ data: { refundNumber: r.refund_id, orderId: order.id, amountPaise: providerAmountToPaise(r.refund_amount), reason: 'Created outside dashboard' } }).catch((e) => {
          if (!isUniqueViolation(e)) throw e;
        });
      }
      await applyRefundStatus(r.refund_id, r.refund_status, { providerRefundId: r.cf_refund_id != null ? String(r.cf_refund_id) : undefined, failureReason: r.status_description });
      return 'PROCESSED';
    }
    default:
      return 'IGNORED'; // unknown event types are acknowledged and recorded
  }
}

// ───────────────────────────── 5. Fulfilment (each step idempotent + resumable) ─────────────────────────────

/**
 * Sends confirmation + Zoom link and syncs CRM. A step is marked done ONLY when the provider accepted it;
 * NOT_CONFIGURED/FAILED steps stay open and show in /ops → Orders as "needs attention".
 */
export async function fulfilOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { cohort: true } });
  if (!order || order.status !== 'PAID') return;
  const c = order.cohort;
  const sessions = sessionsSchema.safeParse(c.sessions);
  const schedule = (sessions.success ? sessions.data : []).map((s) => `${s.label}: ${formatDate(s.startsAt, c.timezone)}, ${formatTime(s.startsAt, c.timezone)}`);
  const common = { orderId: order.orderNumber, name: order.customerName, cohort: c.title, schedule, timezone: c.timezone, amount: formatPaise(order.amountPaise), vipAddon: order.vipAddon };
  const related = { relatedType: 'order', relatedId: order.id };
  const errors: string[] = [];

  const step = async (field: 'confirmationSentAt' | 'zoomSentAt' | 'crmSyncedAt', label: string, run: () => Promise<string[]>) => {
    if (order[field]) return;
    try {
      const statuses = await run();
      if (statuses.every((s) => s === 'SENT')) {
        await prisma.order.update({ where: { id: orderId }, data: { [field]: new Date() } });
        await logEvent(prisma, orderId, `fulfil_${field}`);
      } else {
        errors.push(`${label}: ${statuses.join('/')}`);
      }
    } catch (err) {
      errors.push(`${label}: ${safeError(err)}`);
    }
  };

  await step('confirmationSentAt', 'confirmation', async () => [
    await sendMessage({ kind: 'transactional', channel: 'email', template: 'workshop_confirmation', to: order.customerEmail, data: common, ...related }),
    await sendMessage({ kind: 'transactional', channel: 'whatsapp', template: 'workshop_confirmation', to: order.customerPhone, data: common, ...related }),
  ]);

  await step('zoomSentAt', 'zoom link', async () => {
    if (!c.zoomJoinUrl) throw new Error('No Zoom join link configured for this cohort (set it in /ops → Workshops)');
    const data = { ...common, zoomJoinUrl: c.zoomJoinUrl, zoomPasscode: c.zoomPasscode, reminderCopy: c.reminderCopy };
    return [
      await sendMessage({ kind: 'transactional', channel: 'email', template: 'workshop_zoom_link', to: order.customerEmail, data, ...related }),
      await sendMessage({ kind: 'transactional', channel: 'whatsapp', template: 'workshop_zoom_link', to: order.customerPhone, data, ...related }),
    ];
  });

  await step('crmSyncedAt', 'crm', async () => [
    await crmSync({
      type: 'workshop_registration',
      email: order.customerEmail,
      name: order.customerName,
      phone: order.customerPhone,
      tags: ['workshop-buyer', `cohort:${c.slug}`, ...(order.vipAddon ? ['vip-addon'] : [])],
      fields: { orderId: order.orderNumber, amountPaise: order.amountPaise, attribution: order.attribution },
      ...related,
    }),
  ]);

  await prisma.order.update({ where: { id: orderId }, data: { fulfilmentError: errors.length ? errors.join('; ').slice(0, 1000) : null } });
  if (errors.length) await alertOps('Workshop fulfilment incomplete — retry from /ops', { orderNumber: order.orderNumber, errors });
}

// ───────────────────────────── 6. Reconciliation & status ─────────────────────────────

const g = globalThis as unknown as { __smReconcile?: Map<string, number> };
g.__smReconcile ??= new Map();

/** Server-to-server check against Cashfree — used when a webhook is late or missing. */
export async function reconcileOrder(orderNumber: string, force = false) {
  const order = await prisma.order.findUnique({ where: { orderNumber } });
  if (!order || order.provider === 'MOCK') return order?.status ?? null;
  const last = g.__smReconcile!.get(orderNumber) ?? 0;
  if (!force && Date.now() - last < 10_000) return order.status;
  g.__smReconcile!.set(orderNumber, Date.now());

  const payments = await cfGetPayments(orderNumber);
  const success = payments.find((p) => p.payment_status === 'SUCCESS');
  if (success) {
    const outcome = await markPaid(orderNumber, {
      provider: 'CASHFREE',
      providerPaymentId: String(success.cf_payment_id),
      amountPaise: providerAmountToPaise(success.payment_amount),
      currency: success.payment_currency ?? 'INR',
      method: success.payment_group,
    });
    await logEvent(prisma, order.id, 'reconciled', outcome);
    if (outcome === 'paid') await fulfilOrder(order.id);
  }
  return (await prisma.order.findUniqueOrThrow({ where: { orderNumber } })).status;
}

const PUBLIC_STATUS: Record<OrderStatus, string> = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  DROPPED: 'dropped',
  NEEDS_REVIEW: 'needs_review',
  REFUND_PENDING: 'refund_pending',
  REFUNDED: 'refunded',
};

/** Public, minimal status for the confirmation page. Never includes delivery links. */
export async function getOrderStatus(orderNumber: string, claimPurchaseEvent: boolean) {
  let order = await prisma.order.findUnique({ where: { orderNumber }, include: { cohort: true } });
  if (!order) return null;

  if (order.status === 'PENDING' && Date.now() - order.createdAt.getTime() > 5000) {
    await reconcileOrder(orderNumber).catch((err) => alertOps('Reconciliation failed', { orderNumber, error: safeError(err) }));
    order = (await prisma.order.findUnique({ where: { orderNumber }, include: { cohort: true } }))!;
  }

  // Purchase analytics fires exactly once per order (atomic server-side claim).
  let firePurchase = false;
  if (claimPurchaseEvent && order.status === 'PAID' && !order.purchaseEventClaimedAt) {
    const claimed = await prisma.order.updateMany({ where: { id: order.id, purchaseEventClaimedAt: null }, data: { purchaseEventClaimedAt: new Date() } });
    firePurchase = claimed.count === 1;
  }

  const sessions = sessionsSchema.safeParse(order.cohort.sessions);
  const lineItems = (order.lineItems as { label: string; amountPaise: number }[]).map((l) => ({ label: l.label, amountInr: paiseToRupees(l.amountPaise) }));
  return {
    orderId: order.orderNumber,
    status: PUBLIC_STATUS[order.status],
    amountInr: paiseToRupees(order.amountPaise),
    currency: order.currency,
    lineItems,
    vipAddon: order.vipAddon,
    firstName: order.customerName.split(' ')[0],
    email: order.customerEmail.replace(/^(.{2}).*(@.*)$/, '$1•••$2'),
    cohort: { id: order.cohort.id, title: order.cohort.title, timezone: order.cohort.timezone, sessions: sessions.success ? sessions.data : [] },
    firePurchase,
  };
}
