import Link from 'next/link';
import { OrderStatus } from '@/components/OrderStatus';
import { getSettings } from '@/lib/cms';
import { whatsappHref } from '@/lib/format';
import { pageMeta } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata = pageMeta({ title: 'Workshop confirmation', description: 'Your One Skill Workshop registration status.', path: '/workshop/confirmation', noindex: true });

export default async function ConfirmationPage({ searchParams }: { searchParams: Promise<{ order_id?: string }> }) {
  const { order_id } = await searchParams;
  const settings = await getSettings();

  return (
    <section className="section">
      <div className="container">
        {order_id ? (
          <OrderStatus orderId={order_id} supportEmail={settings.contact.email} whatsappHref={whatsappHref(settings.contact.whatsappNumber, `Hi, I need help with workshop order ${order_id}`)} />
        ) : (
          <div className="status-card">
            <h1 style={{ fontSize: '2rem' }}>No order reference</h1>
            <p>This page shows the status of a workshop order. If you just paid, please use the link from your payment window or check your email.</p>
            <Link href="/workshop" className="btn btn--primary">Go to the workshop page</Link>
          </div>
        )}
      </div>
    </section>
  );
}
