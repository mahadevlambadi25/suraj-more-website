'use client';

// Interactive controls: submit buttons with pending feedback, and confirmation dialogs for
// destructive or customer-facing actions. They wrap the existing server actions unchanged.
import { useRef, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Icon } from './icons';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline';

/** Submit button that shows a spinner and disables itself while its form's server action runs. */
export function SubmitButton({
  children,
  pendingLabel = 'Working…',
  variant = 'primary',
  size,
  name,
  value,
  disabled,
  block,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: Variant;
  size?: 'sm';
  name?: string;
  value?: string;
  disabled?: boolean;
  block?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={disabled || pending} aria-busy={pending} className={`o-btn o-btn--${variant} ${size === 'sm' ? 'o-btn--sm' : ''} ${block ? 'o-btn--block' : ''}`}>
      {pending ? (
        <>
          <span className="o-spinner" aria-hidden="true" /> {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * Opens a confirmation dialog; the dialog's confirm button submits the surrounding form
 * (with optional name/value, e.g. decision=REJECTED). Native required-field validation runs first.
 */
export function ConfirmButton({
  children,
  title,
  message,
  confirmLabel,
  tone = 'default',
  variant = 'secondary',
  size,
  name,
  value,
  disabled,
}: {
  children: ReactNode;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  variant?: Variant;
  size?: 'sm';
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const open = () => {
    const form = trigger.current?.form;
    if (form && !form.reportValidity()) return;
    dialog.current?.showModal();
  };

  return (
    <>
      <button ref={trigger} type="button" onClick={open} disabled={disabled} className={`o-btn o-btn--${variant} ${size === 'sm' ? 'o-btn--sm' : ''}`}>
        {children}
      </button>
      <dialog ref={dialog} className="o-dialog" data-tone={tone} aria-label={title}>
        <div className="o-dialog-body">
          <span className="o-dialog-icon"><Icon name={tone === 'danger' ? 'alert' : 'info'} size={20} /></span>
          <div>
            <h2>{title}</h2>
            <p>{message}</p>
          </div>
        </div>
        <div className="o-dialog-actions">
          <button type="button" className="o-btn o-btn--secondary" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <SubmitButton variant={tone === 'danger' ? 'danger' : 'primary'} name={name} value={value} pendingLabel="Please wait…">
            {confirmLabel}
          </SubmitButton>
        </div>
      </dialog>
    </>
  );
}
