'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const OUTCOMES = [
  { value: 'success', label: 'Pay successfully', cls: 'btn--primary' },
  { value: 'duplicate', label: 'Success + duplicate webhook', cls: 'btn--secondary' },
  { value: 'failed', label: 'Payment fails', cls: 'btn--secondary' },
  { value: 'dropped', label: 'User closes window', cls: 'btn--secondary' },
  { value: 'delayed', label: 'Webhook delayed (stay pending)', cls: 'btn--secondary' },
] as const;

export function MockCheckout({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function simulate(outcome: string) {
    setBusy(outcome);
    if (outcome !== 'delayed') {
      await fetch('/api/dev/simulate-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, outcome }),
      });
    }
    router.push(`/workshop/confirmation?order_id=${encodeURIComponent(orderId)}`);
  }

  return (
    <div className="btn-row">
      {OUTCOMES.map((o) => (
        <button key={o.value} type="button" className={`btn ${o.cls}`} disabled={!!busy} onClick={() => simulate(o.value)}>
          {busy === o.value ? 'Working…' : o.label}
        </button>
      ))}
    </div>
  );
}
