import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/lib/auth/guards';
import { loginAction } from '../actions';
import { SubmitButton } from '../_components/controls';
import { Alert } from '../_components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in', robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  invalid: 'Email or password is incorrect.',
  rate_limited: 'Too many sign-in attempts. Please wait 15 minutes and try again.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; loggedOut?: string }> }) {
  if (await getCurrentAdmin()) redirect('/ops');
  const { error, loggedOut } = await searchParams;

  return (
    <div className="o-auth">
      <div className="o-auth-card">
        <div className="o-auth-brand">
          <span className="o-brand-mark" aria-hidden="true">SM</span>
          <span className="o-brand-text">
            <strong>Suraj More</strong>
            <span>Operations</span>
          </span>
        </div>
        <div className="o-card">
          <div className="o-card-body">
            <h1>Sign in</h1>
            <p className="o-muted" style={{ marginTop: 4, marginBottom: 20 }}>Use your admin account to continue.</p>
            {error && <div style={{ marginBottom: 16 }}><Alert tone="bad">{ERRORS[error] ?? 'Sign-in failed.'}</Alert></div>}
            {loggedOut && <div style={{ marginBottom: 16 }}><Alert tone="ok">You have been signed out.</Alert></div>}
            <form action={loginAction} className="o-form" autoComplete="off">
              <div className="o-field">
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" autoComplete="off" defaultValue="" required className="o-input" />
              </div>
              <div className="o-field">
                <label htmlFor="password">Password</label>
                <input id="password" name="password" type="password" autoComplete="off" defaultValue="" required className="o-input" />
              </div>
              <SubmitButton block pendingLabel="Signing in…">Sign in</SubmitButton>
            </form>
          </div>
        </div>
        <p className="o-auth-foot">Accounts are created by the site owner. Forgot your password? Ask the owner to reset it.</p>
      </div>
    </div>
  );
}
