import crypto from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { alertOps } from '@/lib/integrations';
import { checkExternalLinks, sendWorkshopReminders } from '@/lib/jobs';
import { safeError } from '@/lib/security';

// Daily scheduled jobs (vercel.json → crons). Vercel Cron calls this with `Authorization: Bearer <CRON_SECRET>`.
// Without CRON_SECRET configured the endpoint refuses to run, so it can never be triggered by the public.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorised(req: NextRequest) {
  const secret = env.cronSecret;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

export async function GET(req: NextRequest) {
  if (!env.cronSecret) return NextResponse.json({ ok: false, error: 'CRON_SECRET is not configured' }, { status: 503 });
  if (!authorised(req)) return NextResponse.json({ ok: false }, { status: 401 });

  const result: Record<string, unknown> = {};
  try {
    result.reminders = await sendWorkshopReminders();
  } catch (err) {
    result.reminders = { error: safeError(err) };
    await alertOps('Daily job failed: workshop reminders', { error: safeError(err) });
  }
  try {
    result.links = await checkExternalLinks();
  } catch (err) {
    result.links = { error: safeError(err) };
    await alertOps('Daily job failed: external link check', { error: safeError(err) });
  }
  return NextResponse.json({ ok: true, ...result });
}
