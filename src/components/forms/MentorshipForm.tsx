'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { track } from '@/lib/analytics';
import { COLLECT_REVENUE_RANGE, CONSENT_WORDING, mentorshipSchema, mentorshipStepSchemas, REVENUE_RANGES, TIMELINES } from '@/lib/validation';
import { ArrowRight, Check } from '../Icons';
import { CheckboxField, FormAlert, Honeypot, postJson, PrivacyNote, SelectField, SubmitButton, TextAreaField, TextField, useZodForm } from './fields';

const STEPS = ['About you', 'Your business', 'Fit & timing'];
const DRAFT_KEY = 'sm_mentorship_draft';

export function MentorshipForm() {
  const f = useZodForm({
    name: '',
    email: '',
    phone: '',
    link: '',
    offer: '',
    salesChallenge: '',
    revenueRange: '',
    desiredOutcome: '',
    timeline: '',
    timezone: 'Asia/Kolkata',
    marketingConsent: false,
  });
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const restored = useRef(false);
  const v = f.values;

  // Restore draft + detect timezone once.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) f.set('timezone', tz);
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Record<string, unknown>;
        for (const [k, val] of Object.entries(draft)) if (k in v && typeof val === typeof v[k as keyof typeof v]) f.set(k as keyof typeof v, val as never);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preserve progress across reloads / accidental navigation.
  useEffect(() => {
    if (done) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  }, [v, done]);

  const goTo = (n: number) => {
    setStep(n);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!f.validateAll(mentorshipStepSchemas[step])) return;
    if (step < STEPS.length - 1) return goTo(step + 1);

    if (!f.validateAll(mentorshipSchema)) return;
    setBusy(true);
    const payload = { ...v, revenueRange: COLLECT_REVENUE_RANGE ? v.revenueRange || undefined : undefined };
    const res = await postJson<{ applicationId: string }>('/api/mentorship/apply', payload, f.startedAt);
    setBusy(false);
    if (!res.ok) {
      if (res.json.errors) {
        f.setErrors(res.json.errors);
        const firstStep = mentorshipStepSchemas.findIndex((s) => Object.keys(res.json.errors!).some((k) => k in s.shape));
        if (firstStep >= 0) setStep(firstStep);
      }
      setServerError(res.json.message ?? 'Something went wrong. Please try again — your answers are saved.');
      return;
    }
    // Only non-sensitive fields go to analytics (brief §5).
    track('mentorship_application_submit', { application_id: res.json.applicationId, timeline: v.timeline });
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="status-card" role="status">
        <div className="status-icon status-icon--success"><Check /></div>
        <h3>Application received — thank you, {v.name.split(' ')[0]}.</h3>
        <p>We read every application personally. Here is what happens next:</p>
        <ol className="next-steps">
          <li><span>You’ll get a confirmation email at <strong>{v.email}</strong> in the next few minutes.</span></li>
          <li><span>We review your application within 2 business days.</span></li>
          <li><span>If it looks like a genuine fit, you’ll receive a private link to book a conversation at a time that suits you ({v.timezone}).</span></li>
        </ol>
        <p className="small">If it isn’t a fit right now, we’ll tell you honestly and point you to the best next step.</p>
      </div>
    );
  }

  const pct = ((step + 1) / STEPS.length) * 100;

  return (
    <form className="form" onSubmit={onSubmit} noValidate aria-label="Mentorship application">
      <Honeypot />
      <div className="progress">
        <div className="progress-bar" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-valuetext={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <ol className="progress-steps" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? 'step' : undefined}>
              {i + 1}. {s}
            </li>
          ))}
        </ol>
      </div>

      <h3 ref={headingRef} tabIndex={-1} style={{ outline: 'none' }}>
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </h3>

      {step === 0 && (
        <>
          <TextField id="name" label="Full name" autoComplete="name" value={v.name} error={f.errors.name}
            onChange={(e) => f.set('name', e.target.value)} onBlur={() => f.validateField(mentorshipStepSchemas[0], 'name')} />
          <div className="form-row">
            <TextField id="email" label="Email" type="email" autoComplete="email" value={v.email} error={f.errors.email}
              onChange={(e) => f.set('email', e.target.value)} onBlur={() => f.validateField(mentorshipStepSchemas[0], 'email')} />
            <TextField id="phone" label="Phone / WhatsApp" type="tel" autoComplete="tel" value={v.phone} error={f.errors.phone}
              onChange={(e) => f.set('phone', e.target.value)} onBlur={() => f.validateField(mentorshipStepSchemas[0], 'phone')} />
          </div>
          <TextField id="link" label="Website or main social profile" placeholder="yourwebsite.com or @handle" value={v.link} error={f.errors.link}
            onChange={(e) => f.set('link', e.target.value)} onBlur={() => f.validateField(mentorshipStepSchemas[0], 'link')} />
        </>
      )}

      {step === 1 && (
        <>
          <TextAreaField id="offer" label="What do you sell, and to whom?" hint="Your main offer, who it is for and roughly what it costs." value={v.offer} error={f.errors.offer}
            onChange={(e) => f.set('offer', e.target.value)} onBlur={() => f.validateField(mentorshipStepSchemas[1], 'offer')} />
          <TextAreaField id="salesChallenge" label="What is your biggest sales challenge right now?" value={v.salesChallenge} error={f.errors.salesChallenge}
            onChange={(e) => f.set('salesChallenge', e.target.value)} onBlur={() => f.validateField(mentorshipStepSchemas[1], 'salesChallenge')} />
          {COLLECT_REVENUE_RANGE && (
            <SelectField id="revenueRange" label="Current monthly revenue" optional options={REVENUE_RANGES.map((r) => ({ value: r, label: r }))}
              hint="Used only to check fit. Never shared." value={v.revenueRange} onChange={(e) => f.set('revenueRange', e.target.value)} />
          )}
        </>
      )}

      {step === 2 && (
        <>
          <TextAreaField id="desiredOutcome" label="What would a great outcome look like in 90 days?" value={v.desiredOutcome} error={f.errors.desiredOutcome}
            onChange={(e) => f.set('desiredOutcome', e.target.value)} onBlur={() => f.validateField(mentorshipStepSchemas[2], 'desiredOutcome')} />
          <SelectField id="timeline" label="How soon do you want to start?" options={TIMELINES} value={v.timeline} error={f.errors.timeline}
            onChange={(e) => f.set('timeline', e.target.value)} onBlur={() => f.validateField(mentorshipStepSchemas[2], 'timeline')} />
          <TextField id="timezone" label="Your timezone" hint="Detected automatically — used to offer you suitable call times." value={v.timezone} error={f.errors.timezone}
            onChange={(e) => f.set('timezone', e.target.value)} />
          <CheckboxField id="marketingConsent" checked={v.marketingConsent} onChange={(c) => f.set('marketingConsent', c)}>
            {CONSENT_WORDING.marketing} <span className="muted">(optional)</span>
          </CheckboxField>
        </>
      )}

      <FormAlert message={serverError} />

      <div className="btn-row" style={{ flexWrap: 'nowrap' }}>
        {step > 0 && (
          <button type="button" className="btn btn--secondary btn--lg" onClick={() => goTo(step - 1)} disabled={busy}>
            Back
          </button>
        )}
        <div style={{ flex: 1 }}>
          {step < STEPS.length - 1 ? (
            <button type="submit" className="btn btn--dark btn--lg btn--block">
              Continue <ArrowRight />
            </button>
          ) : (
            <SubmitButton busy={busy} busyLabel="Sending application…">
              Apply for Mentorship <ArrowRight />
            </SubmitButton>
          )}
        </div>
      </div>
      <PrivacyNote>Your answers are read only by Suraj’s team and are never shared with advertisers.</PrivacyNote>
    </form>
  );
}
