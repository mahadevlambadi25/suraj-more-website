import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { handleCashfreeEvent } from '@/lib/orders';

/**
 * DEV ONLY (CASHFREE_MODE=mock): simulates Cashfree webhooks through the exact same handler used for
 * real webhooks, with provider MOCK. Returns 404 in sandbox/production modes.
 */
export async function POST(req: NextRequest) {
  let mode: string;
  try {
    mode = env.cashfree.mode;
  } catch {
    mode = 'locked';
  }
  if (mode !== 'mock') return NextResponse.json({ ok: false }, { status: 404 });

  const { orderId, outcome } = (await req.json()) as { orderId: string; outcome: 'success' | 'duplicate' | 'failed' | 'dropped' };
  const order = await prisma.order.findUnique({ where: { orderNumber: String(orderId) } });
  if (!order || order.provider !== 'MOCK') return NextResponse.json({ ok: false }, { status: 404 });

  const amount = order.amountPaise / 100;
  const cfPaymentId = `mock_${Date.now()}`;
  const payment = (status: string) => ({ cf_payment_id: cfPaymentId, payment_status: status, payment_amount: amount, payment_currency: 'INR', payment_message: status });
  const base = { order: { order_id: order.orderNumber, order_amount: amount, order_currency: 'INR' } };
  const opts = { provider: 'MOCK' as const, signatureVerified: false };

  if (outcome === 'success' || outcome === 'duplicate') {
    const evt = { type: 'PAYMENT_SUCCESS_WEBHOOK', data: { ...base, payment: payment('SUCCESS') } };
    const results = [await handleCashfreeEvent(evt, `mock-${order.orderNumber}-success`, opts)];
    if (outcome === 'duplicate') {
      results.push(await handleCashfreeEvent(evt, `mock-${order.orderNumber}-success`, opts)); // exact retry
      results.push(await handleCashfreeEvent(evt, `mock-${order.orderNumber}-success-resend`, opts)); // re-sent event
    }
    return NextResponse.json({ ok: true, results });
  }
  const type = outcome === 'failed' ? 'PAYMENT_FAILED_WEBHOOK' : 'PAYMENT_USER_DROPPED_WEBHOOK';
  await handleCashfreeEvent(
    { type, data: { ...base, payment: { ...payment(outcome === 'failed' ? 'FAILED' : 'USER_DROPPED'), cf_payment_id: `${cfPaymentId}_${outcome}` } } },
    `mock-${order.orderNumber}-${outcome}-${Date.now()}`,
    opts,
  );
  return NextResponse.json({ ok: true });
}
