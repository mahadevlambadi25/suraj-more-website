import { NextResponse, type NextRequest } from 'next/server';
import { jsonError, parseForm } from '@/lib/api';
import { joinWaitlist } from '@/lib/forms';
import { alertOps } from '@/lib/integrations';
import { safeError } from '@/lib/security';
import { waitlistSchema } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const parsed = await parseForm(req, 'waitlist', waitlistSchema);
  if ('response' in parsed) return parsed.response;
  try {
    await joinWaitlist(parsed.data, parsed.attribution);
  } catch (err) {
    await alertOps('Waitlist signup failed', { error: safeError(err) });
    return jsonError(500, 'We could not add you right now. Please try again.');
  }
  return NextResponse.json({ ok: true });
}
