import { NextResponse, type NextRequest } from 'next/server';
import { jsonError, parseForm } from '@/lib/api';
import { submitMentorshipApplication } from '@/lib/forms';
import { alertOps } from '@/lib/integrations';
import { safeError } from '@/lib/security';
import { mentorshipSchema } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const parsed = await parseForm(req, 'mentorship', mentorshipSchema);
  if ('response' in parsed) return parsed.response;
  try {
    const { applicationId } = await submitMentorshipApplication(parsed.data, parsed.attribution);
    return NextResponse.json({ ok: true, applicationId });
  } catch (err) {
    await alertOps('Mentorship application could not be saved', { error: safeError(err) });
    return jsonError(500, 'We could not submit your application. Please try again — your answers are saved in this browser.');
  }
}
