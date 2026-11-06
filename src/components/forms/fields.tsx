'use client';

import { useCallback, useRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import type { ZodTypeAny } from 'zod';
import { getAttribution } from '@/lib/analytics';

// ───────────────────────────── Validation hook ─────────────────────────────

export function useZodForm<T extends Record<string, unknown>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const startedAt = useRef(Date.now());

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  }, []);

  /** Validate one field on blur against the given schema (inline validation). */
  const validateField = useCallback(
    (schema: ZodTypeAny, key: keyof T) => {
      const r = schema.safeParse(values);
      const issue = r.success ? undefined : r.error.issues.find((i) => i.path[0] === key);
      setErrors((e) => {
        const next = { ...e };
        if (issue) next[key as string] = issue.message;
        else delete next[key as string];
        return next;
      });
    },
    [values],
  );

  /** Validate everything; focus the first invalid field. Values are always preserved. */
  const validateAll = useCallback(
    (schema: ZodTypeAny) => {
      const r = schema.safeParse(values);
      if (r.success) {
        setErrors({});
        return true;
      }
      const errs: Record<string, string> = {};
      for (const i of r.error.issues) {
        const k = String(i.path[0]);
        if (!errs[k]) errs[k] = i.message;
      }
      setErrors(errs);
      requestAnimationFrame(() => {
        const first = document.querySelector<HTMLElement>('[aria-invalid="true"]');
        first?.focus();
      });
      return false;
    },
    [values],
  );

  return { values, set, errors, setErrors, validateField, validateAll, startedAt: startedAt.current };
}

export async function postJson<R = Record<string, unknown>>(url: string, body: Record<string, unknown>, startedAt: number) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, attribution: getAttribution(), startedAt, website_hp: '' }),
    });
    const json = (await res.json().catch(() => ({}))) as R & { ok?: boolean; message?: string; errors?: Record<string, string> };
    return { ok: res.ok && json.ok !== false, status: res.status, json };
  } catch {
    return {
      ok: false,
      status: 0,
      json: { ok: false, message: 'We could not reach the server. Please check your connection and try again — your answers are still here.' } as R & { ok?: boolean; message?: string; errors?: Record<string, string> },
    };
  }
}

// ───────────────────────────── Field primitives ─────────────────────────────

type FieldProps = { id: string; label: string; error?: string; hint?: ReactNode; optional?: boolean; children: (aria: Record<string, string | boolean | undefined>) => ReactNode };

export function Field({ id, label, error, hint, optional, children }: FieldProps) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>
        {label} {optional && <span className="optional">(optional)</span>}
      </label>
      {hint && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, 'aria-required': optional ? undefined : true })}
      {error && (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField(props: Omit<FieldProps, 'children'> & InputHTMLAttributes<HTMLInputElement>) {
  const { id, label, error, hint, optional, ...input } = props;
  return (
    <Field id={id} label={label} error={error} hint={hint} optional={optional}>
      {(aria) => <input className="input" name={id} {...aria} {...input} />}
    </Field>
  );
}

export function TextAreaField(props: Omit<FieldProps, 'children'> & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { id, label, error, hint, optional, ...input } = props;
  return (
    <Field id={id} label={label} error={error} hint={hint} optional={optional}>
      {(aria) => <textarea className="textarea" name={id} {...aria} {...input} />}
    </Field>
  );
}

export function SelectField(props: Omit<FieldProps, 'children'> & SelectHTMLAttributes<HTMLSelectElement> & { options: readonly { value: string; label: string }[]; placeholder?: string }) {
  const { id, label, error, hint, optional, options, placeholder, ...select } = props;
  return (
    <Field id={id} label={label} error={error} hint={hint} optional={optional}>
      {(aria) => (
        <select className="select" name={id} {...aria} {...select}>
          <option value="">{placeholder ?? 'Choose one'}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function CheckboxField({ id, checked, onChange, children, error }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode; error?: string }) {
  return (
    <div>
      <label className="checkbox" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <span>{children}</span>
      </label>
      {error && (
        <p className="field-error" id={`${id}-error`} role="alert" style={{ marginTop: 6 }}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Invisible to humans; bots fill it in. */
export function Honeypot() {
  return (
    <div className="hp" aria-hidden="true">
      <label htmlFor="website_hp">Leave this field empty</label>
      <input id="website_hp" name="website_hp" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

export function FormAlert({ message, tone = 'error' }: { message?: string | null; tone?: 'error' | 'success' | 'info' }) {
  if (!message) return null;
  return (
    <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {message}
    </div>
  );
}

export function SubmitButton({ busy, children, busyLabel }: { busy: boolean; children: ReactNode; busyLabel: string }) {
  return (
    <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy} aria-busy={busy}>
      {busy ? (
        <>
          <span className="spinner" aria-hidden="true" /> {busyLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function PrivacyNote({ children }: { children?: ReactNode }) {
  return (
    <p className="privacy-note">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      <span>
        {children ?? (
          <>
            Your details stay private and are never sold. See our <a href="/privacy-policy">privacy policy</a>.
          </>
        )}
      </span>
    </p>
  );
}
