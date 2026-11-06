import { NextResponse, type NextRequest } from 'next/server';
import { jsonError, parseForm } from '@/lib/api';
import { submitFreeTraining } from '@/lib/forms';
import { alertOps } from '@/lib/integrations';
import { safeError } from '@/lib/security';
import { freeTrainingSchema } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const parsed = await parseForm(req, 'free-training', freeTrainingSchema);
  if ('response' in parsed) return parsed.response;

  let result;
  try {
    result = await submitFreeTraining(parsed.data, parsed.attribution);
  } catch (err) {
    await alertOps('Free training lead could not be saved', { error: safeError(err) });
    return jsonError(500, 'We could not save your details. Please try again in a moment.');
  }

  const res = NextResponse.json({ ok: true, leadId: result.leadId });
  res.cookies.set('sm_ft_access', '1', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 365, path: '/' });
  return res;
}
