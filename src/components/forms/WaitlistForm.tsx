'use client';

import { useState, type FormEvent } from 'react';
import { track } from '@/lib/analytics';
import { CONSENT_WORDING, waitlistSchema } from '@/lib/validation';
import { CheckboxField, FormAlert, Honeypot, postJson, PrivacyNote, SubmitButton, TextField, useZodForm } from './fields';

export function WaitlistForm({ programId, buttonLabel = 'Notify me about the next cohort' }: { programId: 'workshop' | 'inner-circle'; buttonLabel?: string }) {
  const f = useZodForm({ name: '', email: '', programId, marketingConsent: false });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!f.validateAll(waitlistSchema)) return;
    setBusy(true);
    const res = await postJson('/api/waitlist', f.values, f.startedAt);
    setBusy(false);
    if (!res.ok) {
      if (res.json.errors) f.setErrors(res.json.errors);
      setServerError(res.json.message ?? 'Something went wrong. Please try again.');
      return;
    }
    track('waitlist_submit', { program_id: programId });
    setDone(true);
  }

  if (done) {
    return (
      <div className="alert alert--success" role="status">
        <strong>You’re on the list.</strong> We’ll email you as soon as the next cohort’s dates are confirmed — nothing else unless you opted in.
      </div>
    );
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate aria-label="Join the waitlist">
      <Honeypot />
      <div className="form-row">
        <TextField id="wl-name" label="Full name" autoComplete="name" value={f.values.name} error={f.errors.name}
          onChange={(e) => f.set('name', e.target.value)} onBlur={() => f.validateField(waitlistSchema, 'name')} />
        <TextField id="wl-email" label="Email" type="email" autoComplete="email" value={f.values.email} error={f.errors.email}
          onChange={(e) => f.set('email', e.target.value)} onBlur={() => f.validateField(waitlistSchema, 'email')} />
      </div>
      <CheckboxField id="wl-marketing" checked={f.values.marketingConsent} onChange={(c) => f.set('marketingConsent', c)}>
        {CONSENT_WORDING.marketing} <span className="muted">(optional)</span>
      </CheckboxField>
      <FormAlert message={serverError} />
      <SubmitButton busy={busy} busyLabel="Adding you…">{buttonLabel}</SubmitButton>
      <PrivacyNote>We’ll only use your email to tell you when registration opens.</PrivacyNote>
    </form>
  );
}
