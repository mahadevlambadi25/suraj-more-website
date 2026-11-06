'use server';

import type { AdminRole } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as cmd from '@/lib/admin/commands';
import { audit } from '@/lib/audit';
import { clearSessionCookie, getSessionToken, requestMeta, requireAdminAction, setSessionCookie } from '@/lib/auth/guards';
import { AuthError, login, revokeSession, type SessionAdmin } from '@/lib/auth/session';
import { safeError } from '@/lib/security';

// Server actions: Next.js rejects cross-origin action calls (Origin vs Host check) → CSRF protection.
// Each action re-validates the session + role server-side; hidden UI is never relied on.

function safeReturn(path: FormDataEntryValue | null, fallback = '/ops') {
  const p = typeof path === 'string' ? path : '';
  return p.startsWith('/ops') && !p.startsWith('//') ? p : fallback;
}

function withParam(path: string, key: 'msg' | 'err', value: string) {
  const [base, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  params.delete('msg');
  params.delete('err');
  params.set(key, value.slice(0, 300));
  return `${base}?${params.toString()}`;
}

async function run(form: FormData, min: AdminRole, fn: (actor: SessionAdmin & { ipHash: string }) => Promise<string>, opts: { revalidatePublic?: boolean; successPath?: (msg: string) => string } = {}) {
  const returnTo = safeReturn(form.get('returnTo'));
  let target: string;
  try {
    const admin = await requireAdminAction(min);
    const { ipHash } = await requestMeta();
    const msg = await fn({ ...admin, ipHash });
    target = opts.successPath ? opts.successPath(msg) : withParam(returnTo, 'msg', msg);
  } catch (err) {
    if (err instanceof AuthError && err.code === 'UNAUTHENTICATED') redirect('/ops/login');
    const message = err instanceof cmd.CommandError || err instanceof AuthError ? err.message : `Something went wrong: ${safeError(err)}`;
    target = withParam(returnTo, 'err', message);
  }
  revalidatePath('/ops', 'layout');
  if (opts.revalidatePublic) revalidatePath('/', 'layout');
  redirect(target);
}

const s = (form: FormData, k: string) => String(form.get(k) ?? '');

// ── Auth ──
export async function loginAction(form: FormData) {
  const meta = await requestMeta();
  const result = await login(s(form, 'email'), s(form, 'password'), meta);
  if (!result.ok) redirect(`/ops/login?error=${result.reason}`);
  await setSessionCookie(result.token, result.expiresAt);
  redirect('/ops');
}

export async function logoutAction() {
  const token = await getSessionToken();
  if (token) {
    const { ipHash } = await requestMeta();
    const admin = await requireAdminAction('VIEWER').catch(() => null);
    await revokeSession(token);
    if (admin) await audit({ adminId: admin.id, action: 'auth.logout', ipHash });
  }
  await clearSessionCookie();
  redirect('/ops/login?loggedOut=1');
}

// ── Leads ──
export async function updateLeadStatusAction(form: FormData) {
  await run(form, 'ADMIN', async (a) => {
    await cmd.updateLeadStatus(a, s(form, 'leadId'), s(form, 'status'));
    return 'Lead status updated';
  });
}

// ── Workshops ──
function cohortFields(form: FormData) {
  const keys = ['slug', 'title', 'startsAt', 'endsAt', 'status', 'seatLimit', 'priceRupees', 'compareAtRupees', 'vipAddonTitle', 'vipAddonPriceRupees', 'vipAddonIncludes', 'sessions', 'reminderCopy', 'zoomJoinUrl', 'zoomPasscode'];
  return {
    ...Object.fromEntries(keys.map((k) => [k, s(form, k)])),
    compareAtPriceVerified: form.get('compareAtPriceVerified') === 'on',
    vipAddonActive: form.get('vipAddonActive') === 'on',
  };
}

export async function saveCohortAction(form: FormData) {
  const id = s(form, 'cohortId') || null;
  await run(
    form,
    'ADMIN',
    async (a) => {
      const c = await cmd.saveCohort(a, id, cohortFields(form));
      return c.id;
    },
    { revalidatePublic: true, successPath: (cid) => `/ops/workshops/${cid}?msg=${encodeURIComponent(id ? 'Cohort saved' : 'Cohort created')}` },
  );
}

// ── Orders ──
export async function refundOrderAction(form: FormData) {
  await run(form, 'ADMIN', async (a) => {
    if (form.get('confirm') !== 'on') throw new cmd.CommandError('Tick the confirmation box to issue a refund');
    const r = await cmd.refundOrder(a, s(form, 'orderId'), s(form, 'reason'));
    return `Refund ${r.refundNumber} requested`;
  });
}

export async function reconcileOrderAction(form: FormData) {
  await run(form, 'ADMIN', async (a) => `Checked with Cashfree — status: ${await cmd.reconcile(a, s(form, 'orderId'))}`);
}

export async function retryFulfilmentAction(form: FormData) {
  await run(form, 'ADMIN', async (a) => {
    await cmd.retryFulfilment(a, s(form, 'orderId'));
    return 'Fulfilment retried — see delivery status below';
  });
}

export async function syncRefundAction(form: FormData) {
  await run(form, 'ADMIN', async (a) => `Refund status: ${await cmd.syncRefundStatus(a, s(form, 'refundId'))}`);
}

// ── Webhooks ──
export async function retryWebhookAction(form: FormData) {
  await run(form, 'ADMIN', async (a) => `Webhook re-processed: ${await cmd.retryWebhook(a, s(form, 'eventId'))}`);
}

// ── Applications ──
export async function decideApplicationAction(form: FormData) {
  const decision = s(form, 'decision') === 'ACCEPTED' ? 'ACCEPTED' : 'REJECTED';
  await run(form, 'ADMIN', async (a) => {
    const { delivery } = await cmd.decideApplication(a, s(form, 'applicationId'), decision, s(form, 'note'));
    const what = decision === 'ACCEPTED' ? 'Accepted' : 'Rejected';
    return delivery === 'SENT' ? `${what} — applicant emailed` : `${what}, but the email was NOT delivered (${delivery}). Contact the applicant manually.`;
  });
}

// ── Settings ──
export async function updateSettingsAction(form: FormData) {
  await run(
    form,
    'OWNER',
    async (a) => {
      const raw: Record<string, string> = {};
      for (const [k, v] of form.entries()) if (typeof v === 'string' && !k.startsWith('$') && k !== 'returnTo') raw[k] = v;
      await cmd.updateSettings(a, raw);
      return 'Settings saved';
    },
    { revalidatePublic: true },
  );
}

export async function setAdminActiveAction(form: FormData) {
  await run(form, 'OWNER', async (a) => {
    const active = s(form, 'active') === 'true';
    await cmd.setAdminActive(a, s(form, 'adminId'), active);
    return active ? 'Admin activated' : 'Admin deactivated and signed out';
  });
}
