'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { track } from '@/lib/analytics';
import { formatInr } from '@/lib/format';
import { CONSENT_WORDING, workshopOrderSchema } from '@/lib/validation';
import { ArrowRight } from '../Icons';
import { CheckboxField, FormAlert, Honeypot, postJson, PrivacyNote, SubmitButton, TextField, useZodForm } from './fields';

type CashfreeFactory = (opts: { mode: 'sandbox' | 'production' }) => {
  checkout: (opts: { paymentSessionId: string; redirectTarget: '_self' }) => Promise<{ error?: { message: string } }>;
};
declare global {
  interface Window {
    Cashfree?: CashfreeFactory;
  }
}

function loadCashfreeSdk(): Promise<CashfreeFactory> {
  return new Promise((resolve, reject) => {
    if (window.Cashfree) return resolve(window.Cashfree);
    const s = document.createElement('script');
    s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    s.async = true;
    s.onload = () => (window.Cashfree ? resolve(window.Cashfree) : reject(new Error('Cashfree SDK unavailable')));
    s.onerror = () => reject(new Error('Could not load the payment window'));
    document.head.appendChild(s);
  });
}

export interface CheckoutCohort {
  id: string;
  title: string;
  priceInr: number;
  compareAtPriceInr: number | null;
  vipAddon: { active: boolean; priceInr: number; title: string; includes: string[] };
}

export function WorkshopCheckoutForm({ cohort }: { cohort: CheckoutCohort }) {
  const router = useRouter();
  const f = useZodForm({
    name: '',
    email: '',
    phone: '',
    cohortId: cohort.id,
    vipAddon: false,
    termsAccepted: false as boolean,
    marketingConsent: false,
  });
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const v = f.values;
  const total = cohort.priceInr + (v.vipAddon && cohort.vipAddon.active ? cohort.vipAddon.priceInr : 0);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!f.validateAll(workshopOrderSchema)) return;
    setBusy(true);
    track('workshop_checkout_start', { cohort_id: cohort.id, base_price: cohort.priceInr, addon: v.vipAddon, value: total, currency: 'INR' });

    const res = await postJson<{ orderId: string; mode: string; paymentSessionId: string | null }>('/api/workshop/order', v, f.startedAt);
    if (!res.ok) {
      setBusy(false);
      if (res.json.errors) f.setErrors(res.json.errors);
      setServerError(res.json.message ?? 'We could not start your registration. Please try again.');
      if (res.status === 409) router.refresh();
      return;
    }

    const { orderId, mode, paymentSessionId } = res.json;
    if (mode === 'mock') {
      router.push(`/workshop/checkout-mock?order_id=${encodeURIComponent(orderId)}`);
      return;
    }
    try {
      const Cashfree = await loadCashfreeSdk();
      const cf = Cashfree({ mode: mode === 'production' ? 'production' : 'sandbox' });
      const result = await cf.checkout({ paymentSessionId: paymentSessionId!, redirectTarget: '_self' });
      if (result?.error) throw new Error(result.error.message);
    } catch (err) {
      setBusy(false);
      setServerError(
        `${err instanceof Error ? err.message : 'The payment window could not open'}. Your order reference is ${orderId} — please try again or contact support.`,
      );
    }
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate aria-label="Reserve your workshop seat">
      <Honeypot />
      <TextField id="name" label="Full name" autoComplete="name" value={v.name} error={f.errors.name}
        onChange={(e) => f.set('name', e.target.value)} onBlur={() => f.validateField(workshopOrderSchema, 'name')} />
      <TextField id="email" label="Email" type="email" autoComplete="email" inputMode="email" value={v.email} error={f.errors.email}
        hint="Your confirmation and Zoom link are sent here."
        onChange={(e) => f.set('email', e.target.value)} onBlur={() => f.validateField(workshopOrderSchema, 'email')} />
      <TextField id="phone" label="WhatsApp / mobile number" type="tel" autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210"
        value={v.phone} error={f.errors.phone}
        onChange={(e) => f.set('phone', e.target.value)} onBlur={() => f.validateField(workshopOrderSchema, 'phone')} />

      {cohort.vipAddon.active && (
        <label className="choice-card" htmlFor="vipAddon">
          <input id="vipAddon" type="checkbox" checked={v.vipAddon} onChange={(e) => f.set('vipAddon', e.target.checked)} />
          <span>
            <strong style={{ color: 'var(--text)' }}>Add {cohort.vipAddon.title}</strong>
            <span className="small" style={{ display: 'block' }}>{cohort.vipAddon.includes.join(' · ')}</span>
          </span>
          <span className="choice-price">+{formatInr(cohort.vipAddon.priceInr)}</span>
        </label>
      )}

      <table className="summary-table" aria-label="Order summary">
        <tbody>
          <tr>
            <td>{cohort.title}</td>
            <td>
              {cohort.compareAtPriceInr && <span className="compare">{formatInr(cohort.compareAtPriceInr)}</span>}
              {formatInr(cohort.priceInr)}
            </td>
          </tr>
          {v.vipAddon && cohort.vipAddon.active && (
            <tr>
              <td>{cohort.vipAddon.title}</td>
              <td>{formatInr(cohort.vipAddon.priceInr)}</td>
            </tr>
          )}
          <tr className="total">
            <td>Total</td>
            <td>{formatInr(total)}</td>
          </tr>
        </tbody>
      </table>

      <CheckboxField id="termsAccepted" checked={v.termsAccepted} onChange={(c) => f.set('termsAccepted', c)} error={f.errors.termsAccepted}>
        I agree to the <Link href="/terms-and-conditions" target="_blank">Terms</Link> and{' '}
        <Link href="/refund-policy" target="_blank">Refund Policy</Link>. My details will be used to deliver this workshop (confirmation, Zoom link and reminders).
      </CheckboxField>
      <CheckboxField id="marketingConsent" checked={v.marketingConsent} onChange={(c) => f.set('marketingConsent', c)}>
        {CONSENT_WORDING.marketing} <span className="muted">(optional)</span>
      </CheckboxField>

      <FormAlert message={serverError} />
      <SubmitButton busy={busy} busyLabel="Opening secure payment…">
        Reserve Workshop Seat · {formatInr(total)} <ArrowRight />
      </SubmitButton>
      <PrivacyNote>Payments are processed securely by Cashfree. We never see or store your card details.</PrivacyNote>
    </form>
  );
}
