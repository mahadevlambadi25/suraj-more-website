// A one-button form around an existing server action, with optional confirmation dialog.
import type { ReactNode } from 'react';
import { ConfirmButton, SubmitButton } from './controls';

export function ActionForm({
  action,
  fields,
  returnTo,
  label,
  pendingLabel,
  variant = 'secondary',
  confirm,
}: {
  action: (f: FormData) => Promise<void>;
  fields: Record<string, string>;
  returnTo: string;
  label: ReactNode;
  pendingLabel?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline';
  confirm?: { title: string; message: ReactNode; confirmLabel: string; tone?: 'default' | 'danger' };
}) {
  return (
    <form action={action} style={{ display: 'inline-flex' }}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="returnTo" value={returnTo} />
      {confirm ? (
        <ConfirmButton size="sm" variant={variant} {...confirm}>
          {label}
        </ConfirmButton>
      ) : (
        <SubmitButton size="sm" variant={variant} pendingLabel={pendingLabel}>
          {label}
        </SubmitButton>
      )}
    </form>
  );
}
