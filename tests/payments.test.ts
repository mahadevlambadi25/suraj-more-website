import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { POST as webhookPOST } from '@/app/api/webhooks/cashfree/route';
import * as cmd from '@/lib/admin/commands';
import { computeWebhookSignature } from '@/lib/cashfree';
import { prisma } from '@/lib/db';
import { applyRefundStatus, createWorkshopOrder, getOrderStatus, handleCashfreeEvent, OrderError, requestRefund } from '@/lib/orders';
import { buyer, DAY, failedEvent, makeAdmin, makeCohort, successEvent, useSandbox } from './helpers';

const MOCK = { provider: 'MOCK' as const, signatureVerified: false };
const CF = { provider: 'CASHFREE' as const, signatureVerified: true };

async function mockOrder(vipAddon = false) {
  const cohort = await makeCohort();
  const { orderId } = await createWorkshopOrder(buyer({ cohortId: cohort.id, vipAddon }), { utm_source: 'ig' });
  return { cohort, orderNumber: orderId };
}

function signedWebhook(event: unknown, opts: { secret?: string; key?: string } = {}) {
  const raw = JSON.stringify(event);
  const ts = String(Date.now());
  return new NextRequest('https://test.example/api/webhooks/cashfree', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-webhook-timestamp': ts,
      'x-webhook-signature': computeWebhookSignature(raw, ts, opts.secret ?? 'test_secret_key_123'),
      ...(opts.key ? { 'x-idempotency-key': opts.key } : {}),
    },
    body: raw,
  });
}

describe('order creation & server-side pricing', () => {
  it('computes the amount on the server in paise (base + VIP), ignoring anything else', async () => {
    const cohort = await makeCohort();
    const input = { ...buyer({ cohortId: cohort.id, vipAddon: true }), amount: 1, amountPaise: 100 } as never;
    const { orderId } = await createWorkshopOrder(input, undefined);
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber: orderId } });
    expect(o.amountPaise).toBe(4700 + 49900);
    expect(o.status).toBe('PENDING');
    expect(o.lineItems).toEqual([{ label: cohort.title, amountPaise: 4700 }, { label: 'Recording + VIP Pack', amountPaise: 49900 }]);
    const consents = await prisma.consentRecord.findMany({ where: { leadId: o.leadId } });
    expect(consents.map((c) => c.type).sort()).toEqual(['MARKETING', 'TERMS']);
  });

  it('ignores the VIP add-on when it is not active', async () => {
    const cohort = await makeCohort({ vipAddonActive: false });
    const { orderId } = await createWorkshopOrder(buyer({ cohortId: cohort.id, vipAddon: true }), undefined);
    expect((await prisma.order.findUniqueOrThrow({ where: { orderNumber: orderId } })).amountPaise).toBe(4700);
  });

  it.each([
    ['closed', { status: 'CLOSED' as const }],
    ['draft', { status: 'DRAFT' as const }],
    ['already started', { startsAt: new Date(Date.now() - DAY), endsAt: new Date(Date.now() + DAY) }],
  ])('refuses to book a %s cohort', async (_l, overrides) => {
    const cohort = await makeCohort(overrides);
    await expect(createWorkshopOrder(buyer({ cohortId: cohort.id }), undefined)).rejects.toMatchObject({ code: 'COHORT_CLOSED' });
  });

  it('refuses unknown / malformed cohort ids', async () => {
    await expect(createWorkshopOrder(buyer({ cohortId: 'osw-sample-01' }), undefined)).rejects.toBeInstanceOf(OrderError);
  });

  it('enforces the seat limit', async () => {
    const cohort = await makeCohort({ seatLimit: 1 });
    await createWorkshopOrder(buyer({ cohortId: cohort.id }), undefined);
    await expect(createWorkshopOrder(buyer({ cohortId: cohort.id, email: 'b@test.in' }), undefined)).rejects.toMatchObject({ code: 'COHORT_FULL' });
  });

  it('sandbox: creates the Cashfree order with rupee amount and stores the session', async () => {
    const fetchMock = useSandbox((url) => (url.endsWith('/orders') ? { body: { payment_session_id: 'session_abc', cf_order_id: 98765 } } : { status: 404, body: {} }));
    const cohort = await makeCohort();
    const res = await createWorkshopOrder(buyer({ cohortId: cohort.id, vipAddon: true }), undefined);
    expect(res).toMatchObject({ mode: 'sandbox', paymentSessionId: 'session_abc' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://sandbox.cashfree.com/pg/orders');
    const body = JSON.parse(String(init.body));
    expect(body.order_amount).toBe(546);
    expect(body.order_meta.notify_url).toBe('https://test.example/api/webhooks/cashfree');
    expect((init.headers as Record<string, string>)['x-client-secret']).toBe('test_secret_key_123');
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber: res.orderId } });
    expect(o.providerOrderId).toBe('98765');
    expect(o.provider).toBe('CASHFREE');
  });

  it('sandbox: provider failure marks the order FAILED and surfaces a friendly error', async () => {
    useSandbox(() => ({ status: 500, body: { message: 'down' } }));
    const cohort = await makeCohort();
    await expect(createWorkshopOrder(buyer({ cohortId: cohort.id }), undefined)).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER' });
    expect((await prisma.order.findFirstOrThrow()).status).toBe('FAILED');
  });
});

describe('webhooks', () => {
  it('rejects an invalid signature (401) and leaves the order unpaid', async () => {
    useSandbox(() => ({ body: [] }));
    const cohort = await makeCohort();
    const { orderId } = await createWorkshopOrder(buyer({ cohortId: cohort.id }), undefined).catch(() => ({ orderId: '' }));
    const o = await prisma.order.findFirstOrThrow();
    const res = await webhookPOST(signedWebhook(successEvent(o.orderNumber, 47), { secret: 'attacker_secret' }));
    expect(res.status).toBe(401);
    expect((await prisma.order.findFirstOrThrow()).status).not.toBe('PAID');
    expect(await prisma.webhookEvent.count()).toBe(0);
    void orderId;
  });

  it('rejects all real webhooks while in mock mode', async () => {
    const res = await webhookPOST(signedWebhook(successEvent('x', 47)));
    expect(res.status).toBe(401);
  });

  it('sandbox end-to-end: signed webhook + API verification → paid exactly once, registration created', async () => {
    let orderNumber = '';
    useSandbox((url) => {
      if (url.endsWith('/orders')) return { body: { payment_session_id: 's1', cf_order_id: 1 } };
      if (url.includes('/payments')) return { body: [{ cf_payment_id: 'cf_pay_1', payment_status: 'SUCCESS', payment_amount: 47, payment_currency: 'INR' }] };
      return { status: 404, body: {} };
    });
    const cohort = await makeCohort();
    orderNumber = (await createWorkshopOrder(buyer({ cohortId: cohort.id }), undefined)).orderId;

    const res = await webhookPOST(signedWebhook(successEvent(orderNumber, 47), { key: 'evt-1' }));
    expect(res.status).toBe(200);
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber }, include: { payments: true, registration: true, lead: true } });
    expect(o.status).toBe('PAID');
    expect(o.payments).toHaveLength(1);
    expect(o.registration?.status).toBe('CONFIRMED');
    expect(o.lead.status).toBe('CUSTOMER');
    // Delivery providers are not configured → honestly NOT marked as sent.
    expect(o.zoomSentAt).toBeNull();
    expect(o.fulfilmentError).toMatch(/NOT_CONFIGURED/);

    // Exact duplicate delivery (same idempotency key) is not re-processed.
    const dup = await webhookPOST(signedWebhook(successEvent(orderNumber, 47), { key: 'evt-1' }));
    expect(await dup.json()).toMatchObject({ ok: true, duplicate: true });
    expect(await prisma.workshopRegistration.count()).toBe(1);
  });

  it('a success the Cashfree API does not confirm is NOT marked paid', async () => {
    useSandbox((url) => (url.endsWith('/orders') ? { body: { payment_session_id: 's', cf_order_id: 1 } } : { body: [{ cf_payment_id: 'cf_pay_1', payment_status: 'FAILED', payment_amount: 47 }] }));
    const cohort = await makeCohort();
    const { orderId } = await createWorkshopOrder(buyer({ cohortId: cohort.id }), undefined);
    const res = await webhookPOST(signedWebhook(successEvent(orderId, 47)));
    expect(res.status).toBe(500); // Cashfree will retry
    expect((await prisma.order.findUniqueOrThrow({ where: { orderNumber: orderId } })).status).toBe('PENDING');
    expect((await prisma.webhookEvent.findFirstOrThrow()).status).toBe('FAILED');
  });

  it('duplicate success events with DIFFERENT keys (incl. concurrent) never double-fulfil', async () => {
    const { orderNumber } = await mockOrder();
    const results = await Promise.allSettled([
      handleCashfreeEvent(successEvent(orderNumber, 47), 'k-a', MOCK),
      handleCashfreeEvent(successEvent(orderNumber, 47), 'k-b', MOCK),
      handleCashfreeEvent(successEvent(orderNumber, 47), 'k-c', MOCK),
    ]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(await prisma.workshopRegistration.count()).toBe(1);
    expect(await prisma.payment.count()).toBe(1);
    expect(await prisma.orderEvent.count({ where: { type: 'paid' } })).toBe(1);
    expect(await prisma.integrationEvent.count({ where: { template: 'workshop_zoom_link' } })).toBe(2); // email + whatsapp, once
  });

  it('a late failure after success does not reverse the payment', async () => {
    const { orderNumber } = await mockOrder();
    await handleCashfreeEvent(successEvent(orderNumber, 47), 's1', MOCK);
    await handleCashfreeEvent(failedEvent(orderNumber, 47), 'f1', MOCK);
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber }, include: { payments: true } });
    expect(o.status).toBe('PAID');
    expect(o.payments.find((p) => p.providerPaymentId === 'cf_pay_1')?.status).toBe('SUCCESS');
    expect(await prisma.orderEvent.count({ where: { type: 'late_failed_ignored' } })).toBe(1);
  });

  it('out of order: failure first, then success on retry → paid', async () => {
    const { orderNumber } = await mockOrder();
    await handleCashfreeEvent(failedEvent(orderNumber, 47), 'f1', MOCK);
    expect((await prisma.order.findUniqueOrThrow({ where: { orderNumber } })).status).toBe('FAILED');
    await handleCashfreeEvent(successEvent(orderNumber, 47, 'cf_pay_2'), 's2', MOCK);
    expect((await prisma.order.findUniqueOrThrow({ where: { orderNumber } })).status).toBe('PAID');
  });

  it('amount mismatch → NEEDS_REVIEW, no registration', async () => {
    const { orderNumber } = await mockOrder();
    await handleCashfreeEvent(successEvent(orderNumber, 1), 'm1', MOCK);
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber }, include: { registration: true } });
    expect(o.status).toBe('NEEDS_REVIEW');
    expect(o.registration).toBeNull();
  });

  it('currency mismatch → NEEDS_REVIEW', async () => {
    const { orderNumber } = await mockOrder();
    await handleCashfreeEvent(successEvent(orderNumber, 47, 'p', 'USD'), 'cur', MOCK);
    expect((await prisma.order.findUniqueOrThrow({ where: { orderNumber } })).status).toBe('NEEDS_REVIEW');
  });

  it('invalid payment payload (success type without SUCCESS status) is recorded as FAILED', async () => {
    const { orderNumber } = await mockOrder();
    const evt = successEvent(orderNumber, 47);
    evt.data.payment!.payment_status = 'PENDING';
    await expect(handleCashfreeEvent(evt, 'bad', MOCK)).rejects.toThrow();
    expect((await prisma.webhookEvent.findUniqueOrThrow({ where: { idempotencyKey: 'bad' } })).status).toBe('FAILED');
    expect((await prisma.order.findUniqueOrThrow({ where: { orderNumber } })).status).toBe('PENDING');
  });

  it('a failed event can be safely retried by an admin once the cause is fixed', async () => {
    let apiUp = false;
    useSandbox((url) => {
      if (url.endsWith('/orders')) return { body: { payment_session_id: 's', cf_order_id: 1 } };
      return apiUp ? { body: [{ cf_payment_id: 'cf_pay_1', payment_status: 'SUCCESS', payment_amount: 47 }] } : { status: 503, body: {} };
    });
    const cohort = await makeCohort();
    const { orderId } = await createWorkshopOrder(buyer({ cohortId: cohort.id }), undefined);
    await expect(handleCashfreeEvent(successEvent(orderId, 47), 'retry-me', CF)).rejects.toThrow();
    const ev = await prisma.webhookEvent.findUniqueOrThrow({ where: { idempotencyKey: 'retry-me' } });
    expect(ev.status).toBe('FAILED');

    apiUp = true;
    const admin = await makeAdmin('ADMIN');
    await cmd.retryWebhook(admin.actor, ev.id);
    expect((await prisma.webhookEvent.findUniqueOrThrow({ where: { id: ev.id } })).status).toBe('PROCESSED');
    expect((await prisma.order.findUniqueOrThrow({ where: { orderNumber: orderId } })).status).toBe('PAID');
    // Retrying a processed event is refused.
    await expect(cmd.retryWebhook(admin.actor, ev.id)).rejects.toThrow(/only failed/);
    expect(await prisma.auditLog.count({ where: { action: 'webhook.retry' } })).toBe(1);
  });

  it('fires the purchase analytics event exactly once', async () => {
    const { orderNumber } = await mockOrder();
    expect((await getOrderStatus(orderNumber, true))?.firePurchase).toBe(false); // not paid yet
    await handleCashfreeEvent(successEvent(orderNumber, 47), 's', MOCK);
    const claims = await Promise.all([getOrderStatus(orderNumber, true), getOrderStatus(orderNumber, true), getOrderStatus(orderNumber, true)]);
    expect(claims.filter((c) => c?.firePurchase)).toHaveLength(1);
    expect(claims[0]).toMatchObject({ status: 'paid', amountInr: 47 });
    expect(JSON.stringify(claims[0])).not.toContain('zoom'); // no delivery links on the public status
  });
});

describe('refunds', () => {
  async function paidMockOrder() {
    const { orderNumber } = await mockOrder();
    await handleCashfreeEvent(successEvent(orderNumber, 47), 's', MOCK);
    return prisma.order.findUniqueOrThrow({ where: { orderNumber } });
  }

  it('refunds a paid order and blocks a duplicate refund request', async () => {
    const order = await paidMockOrder();
    const admin = await makeAdmin('ADMIN');
    await cmd.refundOrder(admin.actor, order.id, 'Customer asked');
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { refunds: true, registration: true } });
    expect(o.status).toBe('REFUNDED');
    expect(o.refunds).toHaveLength(1);
    expect(o.registration?.status).toBe('REFUNDED');
    await expect(cmd.refundOrder(admin.actor, order.id, 'Again please')).rejects.toThrow(/Only paid orders/);
    expect(await prisma.refund.count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'refund.request' } })).toBe(1);
  });

  it('concurrent refund requests create exactly one refund', async () => {
    const order = await paidMockOrder();
    const results = await Promise.allSettled([requestRefund(order.id, { reason: 'a' }), requestRefund(order.id, { reason: 'b' }), requestRefund(order.id, { reason: 'c' })]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.refund.count()).toBe(1);
  });

  it('cannot refund an unpaid order', async () => {
    const { orderNumber } = await mockOrder();
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber } });
    await expect(requestRefund(o.id, { reason: 'x' })).rejects.toMatchObject({ code: 'REFUND_NOT_ALLOWED' });
  });

  it('sandbox: refund goes PENDING via API, then SUCCESS via webhook; a late PENDING never regresses it', async () => {
    const fetchMock = useSandbox((url, init) => {
      if (url.endsWith('/orders')) return { body: { payment_session_id: 's', cf_order_id: 1 } };
      if (url.endsWith('/payments')) return { body: [{ cf_payment_id: 'cf_pay_1', payment_status: 'SUCCESS', payment_amount: 47 }] };
      if (url.endsWith('/refunds') && init?.method === 'POST') {
        const b = JSON.parse(String(init.body));
        return { body: { refund_id: b.refund_id, cf_refund_id: 555, refund_status: 'PENDING', refund_amount: b.refund_amount } };
      }
      return { status: 404, body: {} };
    });
    const cohort = await makeCohort();
    const { orderId } = await createWorkshopOrder(buyer({ cohortId: cohort.id }), undefined);
    await handleCashfreeEvent(successEvent(orderId, 47), 'pay', CF);
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: orderId } });

    const refund = await requestRefund(order.id, { reason: 'test' });
    const refundCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/refunds'))!;
    expect((refundCall[1] as RequestInit & { headers: Record<string, string> }).headers['x-idempotency-key']).toBe(refund.refundNumber);
    let r = await prisma.refund.findUniqueOrThrow({ where: { id: refund.id }, include: { order: true } });
    expect([r.status, r.providerRefundId, r.order.status]).toEqual(['PENDING', '555', 'REFUND_PENDING']);

    const refundEvt = { type: 'REFUND_STATUS_WEBHOOK', data: { refund: { order_id: orderId, refund_id: refund.refundNumber, cf_refund_id: 555, refund_status: 'SUCCESS' as const, refund_amount: 47 } } };
    await handleCashfreeEvent(refundEvt, 'rf-success', CF);
    await applyRefundStatus(refund.refundNumber, 'PENDING'); // late/out-of-order
    r = await prisma.refund.findUniqueOrThrow({ where: { id: refund.id }, include: { order: true } });
    expect([r.status, r.order.status]).toEqual(['SUCCESS', 'REFUNDED']);
  });

  it('sandbox: a definitive provider rejection releases the order; an unknown outcome keeps it locked', async () => {
    let mode: 'reject' | 'timeout' = 'reject';
    useSandbox((url) => {
      if (url.endsWith('/orders')) return { body: { payment_session_id: 's', cf_order_id: 1 } };
      if (url.endsWith('/payments')) return { body: [{ cf_payment_id: 'cf_pay_1', payment_status: 'SUCCESS', payment_amount: 47 }] };
      if (url.endsWith('/refunds')) return mode === 'reject' ? { status: 400, body: { message: 'refund not allowed' } } : { status: 504, body: {} };
      return { status: 404, body: {} };
    });
    const cohort = await makeCohort();
    const { orderId } = await createWorkshopOrder(buyer({ cohortId: cohort.id }), undefined);
    await handleCashfreeEvent(successEvent(orderId, 47), 'pay', CF);
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: orderId } });

    await expect(requestRefund(order.id, { reason: 'x' })).rejects.toThrow();
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID');
    expect((await prisma.refund.findFirstOrThrow()).status).toBe('FAILED');

    mode = 'timeout';
    await expect(requestRefund(order.id, { reason: 'y' })).rejects.toThrow();
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('REFUND_PENDING');
    // …so a second refund cannot be issued while the first outcome is unknown.
    await expect(requestRefund(order.id, { reason: 'z' })).rejects.toMatchObject({ code: 'REFUND_NOT_ALLOWED' });
  });
});
