import crypto from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyWebhookSignature, type CashfreeWebhook } from '@/lib/cashfree';
import { env } from '@/lib/env';
import { alertOps } from '@/lib/integrations';
import { handleCashfreeEvent } from '@/lib/orders';
import { clientIp, hashIdentifier } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * Step 2 of the payment flow — the ONLY public entry point that can make an order "paid".
 * 1. Verify HMAC signature on the RAW body (before JSON parsing).
 * 2. Store the event under a unique idempotency key (duplicates are never re-processed).
 * 3. Return 5xx on processing errors so Cashfree retries; failures are visible in /ops → Webhooks.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get('x-webhook-signature');
  const timestamp = req.headers.get('x-webhook-timestamp');

  let mode: string;
  try {
    mode = env.cashfree.mode;
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  if (mode === 'mock' || !verifyWebhookSignature(raw, timestamp, signature)) {
    await alertOps('Rejected Cashfree webhook (invalid signature or mock mode)', { ipHash: hashIdentifier(clientIp(req.headers)) });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let event: CashfreeWebhook;
  try {
    event = JSON.parse(raw);
    if (!event?.type || !event?.data) throw new Error('bad shape');
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const idempotencyKey = req.headers.get('x-idempotency-key') || crypto.createHash('sha256').update(raw).digest('hex');

  try {
    const result = await handleCashfreeEvent(event, idempotencyKey, { provider: 'CASHFREE', signatureVerified: true });
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
