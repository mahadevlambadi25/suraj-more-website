import { notFound } from 'next/navigation';
import { MockCheckout } from './MockCheckout';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { formatPaise } from '@/lib/money';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Test checkout', robots: { index: false, follow: false } };

/** DEV ONLY: stands in for the Cashfree payment window when CASHFREE_MODE=mock. */
export default async function MockCheckoutPage({ searchParams }: { searchParams: Promise<{ order_id?: string }> }) {
  let mode = 'locked';
  try {
    mode = env.cashfree.mode;
  } catch {
    /* production lock */
  }
  if (mode !== 'mock') notFound();
  const { order_id } = await searchParams;
  const order = order_id ? await prisma.order.findUnique({ where: { orderNumber: order_id } }) : null;
  if (!order || order.provider !== 'MOCK') notFound();
  const lineItems = order.lineItems as { label: string }[];

  return (
    <section className="section">
      <div className="container container--narrow">
        <div className="form-card">
          <div className="draft-banner">
            <strong>Test mode.</strong> This simulated payment window is only available while <code>CASHFREE_MODE=mock</code>. Buttons below send a
            server-side webhook event through the same code path Cashfree uses.
          </div>
          <h1 style={{ fontSize: '1.8rem' }}>Simulated payment</h1>
          <p>
            Order <strong>{order.orderNumber}</strong> · {lineItems.map((l) => l.label).join(' + ')} · <strong>{formatPaise(order.amountPaise)}</strong>
          </p>
          <MockCheckout orderId={order.orderNumber} />
        </div>
      </div>
    </section>
  );
}
