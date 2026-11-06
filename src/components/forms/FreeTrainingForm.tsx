'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { track } from '@/lib/analytics';
import { AUDIENCE_TYPES, CONSENT_WORDING, freeTrainingSchema } from '@/lib/validation';
import { ArrowRight } from '../Icons';
import { CheckboxField, FormAlert, Honeypot, postJson, PrivacyNote, SelectField, SubmitButton, TextField, useZodForm } from './fields';

export function FreeTrainingForm({ formId = 'free_training_main' }: { formId?: string }) {
  const router = useRouter();
  const f = useZodForm({
    name: '',
    email: '',
    phone: '',
    audienceType: '',
    city: '',
    businessUrl: '',
    whatsappConsent: true,
    marketingConsent: false,
  });
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const v = f.values;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!f.validateAll(freeTrainingSchema)) return;
    setBusy(true);
    const res = await postJson('/api/leads/free-training', v, f.startedAt);
    if (!res.ok) {
      setBusy(false);
      if (res.json.errors) f.setErrors(res.json.errors);
      setServerError(res.json.message ?? 'Something went wrong. Please try again.');
      return;
    }
    track('free_training_submit', { form_id: formId, audience_type: v.audienceType, marketing_consent: v.marketingConsent, whatsapp_consent: v.whatsappConsent });
    router.push('/free-training/watch');
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate aria-label="Get instant access to the free training">
      <Honeypot />
      <TextField id="name" label="Full name" autoComplete="name" value={v.name} error={f.errors.name}
        onChange={(e) => f.set('name', e.target.value)} onBlur={() => f.validateField(freeTrainingSchema, 'name')} />
      <TextField id="email" label="Email" type="email" autoComplete="email" inputMode="email" value={v.email} error={f.errors.email}
        onChange={(e) => f.set('email', e.target.value)} onBlur={() => f.validateField(freeTrainingSchema, 'email')} />
      <TextField id="phone" label="WhatsApp / mobile number" type="tel" autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210"
        value={v.phone} error={f.errors.phone}
        onChange={(e) => f.set('phone', e.target.value)} onBlur={() => f.validateField(freeTrainingSchema, 'phone')} />
      <SelectField id="audienceType" label="What best describes you?" options={AUDIENCE_TYPES} value={v.audienceType} error={f.errors.audienceType}
        onChange={(e) => f.set('audienceType', e.target.value)} onBlur={() => f.validateField(freeTrainingSchema, 'audienceType')} />
      <div className="form-row">
        <TextField id="city" label="City" optional autoComplete="address-level2" value={v.city}
          onChange={(e) => f.set('city', e.target.value)} />
        <TextField id="businessUrl" label="Business website or @handle" optional value={v.businessUrl} error={f.errors.businessUrl}
          onChange={(e) => f.set('businessUrl', e.target.value)} onBlur={() => f.validateField(freeTrainingSchema, 'businessUrl')} />
      </div>
      <CheckboxField id="whatsappConsent" checked={v.whatsappConsent} onChange={(c) => f.set('whatsappConsent', c)}>
        {CONSENT_WORDING.whatsapp}
      </CheckboxField>
      <CheckboxField id="marketingConsent" checked={v.marketingConsent} onChange={(c) => f.set('marketingConsent', c)}>
        {CONSENT_WORDING.marketing} <span className="muted">(optional)</span>
      </CheckboxField>
      <FormAlert message={serverError} />
      <SubmitButton busy={busy} busyLabel="Opening your training…">
        Get Instant Access <ArrowRight />
      </SubmitButton>
      <PrivacyNote />
    </form>
  );
}
