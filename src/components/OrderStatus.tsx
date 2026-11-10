'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { formatDate, formatInr, formatTime } from '@/lib/format';
import { Check, Clock, Cross } from './Icons';

type Status = {
  orderId: string;
  status: 'pending' | 'paid' | 'failed' | 'dropped' | 'refund_pending' | 'refunded' | 'needs_review';
  amountInr: number;
  currency: string;
  lineItems: { label: string; amountInr: number }[];
  vipAddon: boolean;
  firstName: string;
  email: string;
  cohort: { id: string; slug?: string; title: string; timezone: string; sessions: { label: string; startsAt: string; endsAt: string; topic: string }[] } | null;
  delivery?: { confirmation: boolean; joinDetails: boolean };
  firePurchase: boolean;
};

/**
 * Confirmation page state machine. The page NEVER marks anything paid — it only reads the
 * server's status (set by the verified Cashfree webhook or server-side reconciliation).
 */
export function OrderStatus({ orderId, supportEmail, whatsappHref }: { orderId: string; supportEmail: string; whatsappHref: string }) {
  const [data, setData] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const purchaseSent = useRef(false);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    let n = 0;
    const poll = async () => {
      n += 1;
      setAttempts(n);
      try {
        const res = await fetch(`/api/workshop/order/${encodeURIComponent(orderId)}?claim=1`, { cache: 'no-store' });
        if (res.status === 404) {
          setError('We could not find this order. If you were charged, contact support with your payment reference.');
          return;
        }
        const json: Status = await res.json();
        if (stop) return;
        setData(json);
        if (json.firePurchase && !purchaseSent.current) {
          purchaseSent.current = true;
          track('purchase', {
            transaction_id: json.orderId,
            value: json.amountInr,
            currency: json.currency,
            product: 'one_skill_workshop',
            cohort_id: json.cohort?.id,
            vip_addon: json.vipAddon,
          });
        }
        if (json.status === 'pending' && n < 40) timer = setTimeout(poll, n < 10 ? 2000 : 5000);
      } catch {
        if (!stop && n < 40) timer = setTimeout(poll, 4000);
      }
    };
    poll();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [orderId]);

  const support = (
    <p className="small">
      Need help? Email <a href={`mailto:${supportEmail}?subject=Workshop order ${orderId}`}>{supportEmail}</a> or{' '}
      <a href={whatsappHref} target="_blank" rel="noopener noreferrer">message us on WhatsApp</a> with your order reference <strong>{orderId}</strong>.
    </p>
  );

  if (error) {
    return (
      <div className="status-card">
        <div className="status-icon status-icon--error"><Cross /></div>
        <h1 style={{ fontSize: '2rem' }}>Order not found</h1>
        <p>{error}</p>
        {support}
      </div>
    );
  }

  if (!data || data.status === 'pending') {
    const slow = attempts >= 40;
    return (
      <div className="status-card" role="status" aria-live="polite">
        <div className="status-icon status-icon--pending">{slow ? <Clock /> : <span className="spinner" style={{ width: 28, height: 28 }} />}</div>
        <h1 style={{ fontSize: '2rem' }}>{slow ? 'Your payment is still being confirmed' : 'Confirming your payment…'}</h1>
        <p>
          {slow
            ? 'This sometimes takes a few minutes with UPI or netbanking. You do not need to pay again — as soon as the bank confirms, we will email your confirmation and Zoom link.'
            : 'We are waiting for secure confirmation from the payment provider. This usually takes a few seconds. Please don’t close this page or pay again.'}
        </p>
        {support}
      </div>
    );
  }

  if (data.status === 'failed' || data.status === 'dropped') {
    return (
      <div className="status-card" role="status">
        <div className="status-icon status-icon--error"><Cross /></div>
        <h1 style={{ fontSize: '2rem' }}>{data.status === 'dropped' ? 'Payment was not completed' : 'Payment didn’t go through'}</h1>
        <p>No money was taken for this attempt. If your account was debited, it will be reversed automatically by your bank.</p>
        <div className="btn-row" style={{ justifyContent: 'center', margin: '24px 0' }}>
          <Link href={data.cohort?.slug ? `/workshop/${data.cohort.slug}#register` : '/workshop'} className="btn btn--primary">Try Again</Link>
        </div>
        {support}
      </div>
    );
  }

  if (data.status === 'needs_review') {
    return (
      <div className="status-card" role="status">
        <div className="status-icon status-icon--pending"><Clock /></div>
        <h1 style={{ fontSize: '2rem' }}>We’re checking your payment</h1>
        <p>Your payment was received but needs a quick manual check. Our team has been notified and will email you shortly. Please don’t pay again.</p>
        {support}
      </div>
    );
  }

  if (data.status === 'refund_pending' || data.status === 'refunded') {
    return (
      <div className="status-card" role="status">
        <div className="status-icon status-icon--pending"><Clock /></div>
        <h1 style={{ fontSize: '2rem' }}>{data.status === 'refunded' ? 'This order has been refunded' : 'Refund in progress'}</h1>
        <p>Refunds go back to the original payment method. Bank timelines apply.</p>
        {support}
      </div>
    );
  }

  // Paid
  const c = data.cohort;
  return (
    <div className="status-card" role="status">
      <div className="status-icon status-icon--success"><Check /></div>
      <p className="eyebrow" style={{ justifyContent: 'center' }}>Seat confirmed</p>
      <h1 style={{ fontSize: 'clamp(2rem,4vw,2.6rem)' }}>You’re in, {data.firstName}.</h1>
      <p>
        Payment of <strong>{formatInr(data.amountInr)}</strong> received.{' '}
        {/* Only claim delivery when the provider actually accepted both messages. */}
        {data.delivery?.confirmation && data.delivery?.joinDetails ? (
          <>Your confirmation and Zoom link are on their way to <strong>{data.email}</strong>.</>
        ) : (
          <>Your confirmation and Zoom link will be sent to <strong>{data.email}</strong> before the workshop.</>
        )}
      </p>
      <p className="small">Order reference: <strong>{data.orderId}</strong></p>

      {c && (
        <div className="card card--flat" style={{ textAlign: 'left', margin: '28px 0' }}>
          <h2 style={{ fontSize: '1.2rem' }}>{c.title}</h2>
          <ul className="check-list" style={{ margin: 0 }}>
            {c.sessions.map((s) => (
              <li key={s.label}>
                <strong>{s.label}:</strong> {formatDate(s.startsAt, c.timezone)}, {formatTime(s.startsAt, c.timezone)} – {formatTime(s.endsAt, c.timezone)}
              </li>
            ))}
          </ul>
          <p className="small" style={{ margin: '12px 0 0' }}>All times shown in {c.timezone === 'Asia/Kolkata' ? 'India Standard Time (IST)' : c.timezone}.</p>
        </div>
      )}

      <ol className="next-steps">
        <li>
          <span>
            {data.delivery?.confirmation && data.delivery?.joinDetails
              ? <>Check <strong>{data.email}</strong> for your confirmation and Zoom link (also check Promotions/Spam).</>
              : <>If you haven’t received your Zoom link 24 hours before the first session, contact us with your order reference.</>}
          </span>
        </li>
        <li><span>Add both sessions to your calendar and join 5 minutes early from a laptop if you can.</span></li>
      </ol>
      {support}
    </div>
  );
}
