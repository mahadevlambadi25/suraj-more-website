import 'server-only';
import crypto from 'crypto';
import { env } from './env';

// Cashfree Payment Gateway (PG) API, version 2023-08-01 — server-to-server only. Credentials never reach the browser.
// Docs: https://www.cashfree.com/docs/api-reference/payments/latest/orders/create

export class CashfreeApiError extends Error {
  constructor(
    message: string,
    public status: number, // 0 = network/timeout (outcome unknown)
  ) {
    super(message);
  }
  /** 4xx = Cashfree definitively rejected the request. 0/5xx = outcome unknown. */
  get definitive() {
    return this.status >= 400 && this.status < 500;
  }
}

function headers() {
  const cf = env.cashfree;
  if (!cf.appId || !cf.secret) throw new Error('Cashfree credentials are not configured (CASHFREE_APP_ID / CASHFREE_SECRET_KEY)');
  return {
    'Content-Type': 'application/json',
    'x-api-version': cf.apiVersion,
    'x-client-id': cf.appId,
    'x-client-secret': cf.secret,
  };
}

async function call<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${env.cashfree.baseUrl}${path}`, {
      ...init,
      headers: { ...headers(), ...(init.idempotencyKey ? { 'x-idempotency-key': init.idempotencyKey } : {}) },
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    });
  } catch (err) {
    throw new CashfreeApiError(`Cashfree request failed: ${err instanceof Error ? err.message : 'network error'}`, 0);
  }
  const json = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new CashfreeApiError(`Cashfree ${path} failed (${res.status}): ${json.message ?? 'unknown error'}`, res.status);
  return json;
}

/** Cashfree expects a 10-digit Indian mobile; keep other numbers as digits. */
export function normalisePhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export async function cfCreateOrder(order: {
  orderNumber: string;
  amountPaise: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  note: string;
  tags: Record<string, string>;
}) {
  const json = await call<{ payment_session_id?: string; cf_order_id?: string | number }>('/orders', {
    method: 'POST',
    idempotencyKey: order.orderNumber,
    body: JSON.stringify({
      order_id: order.orderNumber,
      order_amount: order.amountPaise / 100,
      order_currency: 'INR',
      customer_details: {
        customer_id: crypto.createHash('sha256').update(order.customerEmail).digest('hex').slice(0, 32),
        customer_name: order.customerName,
        customer_email: order.customerEmail,
        customer_phone: normalisePhone(order.customerPhone),
      },
      order_meta: {
        return_url: `${env.siteUrl}/workshop/confirmation?order_id={order_id}`,
        notify_url: `${env.siteUrl}/api/webhooks/cashfree`,
      },
      order_note: order.note.slice(0, 200),
      order_tags: order.tags,
    }),
  });
  if (!json.payment_session_id) throw new CashfreeApiError('Cashfree did not return a payment session', 502);
  return { paymentSessionId: json.payment_session_id, providerOrderId: json.cf_order_id != null ? String(json.cf_order_id) : null };
}

export interface CfPayment {
  cf_payment_id: string | number;
  payment_status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'USER_DROPPED' | 'CANCELLED' | 'VOID' | 'NOT_ATTEMPTED';
  payment_amount: number;
  payment_currency?: string;
  payment_group?: string;
  payment_message?: string;
}

export function cfGetPayments(orderNumber: string) {
  return call<CfPayment[]>(`/orders/${encodeURIComponent(orderNumber)}/payments`);
}

export interface CfRefund {
  cf_refund_id?: string | number;
  refund_id: string;
  refund_status: 'SUCCESS' | 'PENDING' | 'CANCELLED' | 'ONHOLD' | 'FAILED';
  refund_amount: number;
  status_description?: string;
}

export function cfCreateRefund(orderNumber: string, amountPaise: number, refundNumber: string, note?: string) {
  return call<CfRefund>(`/orders/${encodeURIComponent(orderNumber)}/refunds`, {
    method: 'POST',
    idempotencyKey: refundNumber,
    body: JSON.stringify({ refund_amount: amountPaise / 100, refund_id: refundNumber, refund_note: (note ?? 'Refund').slice(0, 100) }),
  });
}

export function cfGetRefund(orderNumber: string, refundNumber: string) {
  return call<CfRefund>(`/orders/${encodeURIComponent(orderNumber)}/refunds/${encodeURIComponent(refundNumber)}`);
}

/**
 * Webhook signature: base64(HMAC-SHA256(timestamp + rawBody, secret)).
 * Must be computed on the RAW body string, before JSON parsing.
 */
export function computeWebhookSignature(rawBody: string, timestamp: string, secret = env.cashfree.webhookSecret) {
  return crypto.createHmac('sha256', secret).update(timestamp + rawBody).digest('base64');
}

export function verifyWebhookSignature(rawBody: string, timestamp: string | null, signature: string | null) {
  const secret = env.cashfree.webhookSecret;
  if (!timestamp || !signature || !secret) return false;
  const a = Buffer.from(computeWebhookSignature(rawBody, timestamp, secret));
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export interface CashfreeWebhook {
  type: string;
  event_time?: string;
  data: {
    order?: { order_id: string; order_amount?: number; order_currency?: string };
    payment?: {
      cf_payment_id: string | number;
      payment_status: string;
      payment_amount: number;
      payment_currency?: string;
      payment_message?: string;
      payment_group?: string;
      payment_time?: string;
    };
    refund?: {
      order_id: string;
      refund_id?: string;
      cf_refund_id?: string | number;
      refund_status: 'SUCCESS' | 'PENDING' | 'CANCELLED' | 'ONHOLD' | 'FAILED';
      refund_amount: number;
      status_description?: string;
    };
  };
}
