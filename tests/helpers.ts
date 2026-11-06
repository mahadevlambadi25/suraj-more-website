import crypto from 'node:crypto';
import type { AdminRole, Prisma } from '@prisma/client';
import { vi } from 'vitest';
import { hashPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/db';
import type { CashfreeWebhook } from '@/lib/cashfree';

export const DAY = 86_400_000;

export async function makeCohort(overrides: Partial<Prisma.WorkshopCohortCreateInput> = {}) {
  const start = new Date(Date.now() + 10 * DAY);
  return prisma.workshopCohort.create({
    data: {
      slug: `c-${crypto.randomBytes(4).toString('hex')}`,
      title: 'The One Skill Workshop — Test',
      startsAt: start,
      endsAt: new Date(start.getTime() + DAY),
      status: 'OPEN',
      pricePaise: 4700,
      vipAddonActive: true,
      vipAddonPricePaise: 49900,
      vipAddonIncludes: ['Workbook'],
      sessions: [{ label: 'Day 1', startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 3 * 3_600_000).toISOString(), topic: 'Intent' }],
      zoomJoinUrl: 'https://zoom.us/j/123',
      ...overrides,
    },
  });
}

export const buyer = (o: Partial<{ email: string; vipAddon: boolean; cohortId: string }> = {}) => ({
  name: 'Kiran Patel',
  email: o.email ?? 'kiran@test.in',
  phone: '+91 98111 22222',
  cohortId: o.cohortId ?? '',
  vipAddon: o.vipAddon ?? false,
  termsAccepted: true as const,
  marketingConsent: false,
});

export async function makeAdmin(role: AdminRole = 'ADMIN', password = 'correct horse 42 battery') {
  const admin = await prisma.admin.create({
    data: { email: `${role.toLowerCase()}-${crypto.randomBytes(3).toString('hex')}@test.in`, name: `${role} user`, role, passwordHash: await hashPassword(password) },
  });
  return { ...admin, password, actor: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } };
}

export function successEvent(orderNumber: string, amountRupees: number, paymentId = 'cf_pay_1', currency = 'INR'): CashfreeWebhook {
  return {
    type: 'PAYMENT_SUCCESS_WEBHOOK',
    data: {
      order: { order_id: orderNumber, order_amount: amountRupees, order_currency: currency },
      payment: { cf_payment_id: paymentId, payment_status: 'SUCCESS', payment_amount: amountRupees, payment_currency: currency, payment_group: 'upi' },
    },
  };
}

export function failedEvent(orderNumber: string, amountRupees: number, paymentId = 'cf_pay_f1'): CashfreeWebhook {
  return {
    type: 'PAYMENT_FAILED_WEBHOOK',
    data: {
      order: { order_id: orderNumber, order_amount: amountRupees },
      payment: { cf_payment_id: paymentId, payment_status: 'FAILED', payment_amount: amountRupees, payment_currency: 'INR', payment_message: 'Bank declined' },
    },
  };
}

/** Switches to Cashfree SANDBOX mode with fake test credentials and a stubbed Cashfree API. */
export function useSandbox(handler: (url: string, init?: RequestInit) => { status?: number; body: unknown } | Promise<{ status?: number; body: unknown }>) {
  process.env.CASHFREE_MODE = 'sandbox';
  process.env.CASHFREE_APP_ID = 'TEST_APP_ID';
  process.env.CASHFREE_SECRET_KEY = 'test_secret_key_123';
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const r = await handler(String(url), init);
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
